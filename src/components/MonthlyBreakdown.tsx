import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { formatCurrency, formatNumber, parseDateSafe } from '@/lib/formatters';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Package, FileDown, Loader2, Pencil, User, DollarSign, Settings2 } from 'lucide-react';
import { generateBreakdownPdf } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { EditInvoiceDialog } from '@/components/EditInvoiceDialog';
import { EditGlobalPercentageDialog } from '@/components/EditGlobalPercentageDialog';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyBreakdownProps {
  invoices: Invoice[];
  clients?: Client[];
  onUpdateInvoice?: (
    id: string,
    ncf: string,
    invoiceDate: string,
    totalAmount: number,
    restAmount: number,
    restPercentage: number,
    restCommission: number,
    totalCommission: number,
    products: { name: string; amount: number; percentage: number; commission: number }[],
    clientId?: string | null
  ) => Promise<any>;
  onDeleteInvoice?: (id: string) => Promise<boolean>;
  onRefreshInvoices?: () => void;
  sellerName?: string;
}

interface ProductEntry {
  ncf: string;
  date: string;
  amount: number;
  clientId?: string | null;
  clientName?: string;
}

interface ProductBreakdown {
  name: string;
  percentage: number;
  entries: ProductEntry[];
  totalAmount: number;
  totalCommission: number;
}

const getMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const MonthlyBreakdown = ({ invoices, clients, onUpdateInvoice, onDeleteInvoice, onRefreshInvoices, sellerName }: MonthlyBreakdownProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return getMonthKey(now);
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const getClientName = (clientId?: string | null) => {
    if (!clientId || !clients) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const months = useMemo(() => {
    const uniqueMonths = new Set<string>();
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      uniqueMonths.add(getMonthKey(date));
    }
    invoices.forEach(inv => {
      const date = parseDateSafe(inv.invoice_date || inv.created_at);
      uniqueMonths.add(getMonthKey(date));
    });
    return Array.from(uniqueMonths).sort().reverse();
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    // Usar el día 15 para asegurar que el mes es correcto en cualquier zona horaria
    const start = startOfMonth(new Date(year, month - 1, 15));
    const end = endOfMonth(new Date(year, month - 1, 15));
    
    return invoices.filter(inv => {
      const invDate = parseDateSafe(inv.invoice_date || inv.created_at);
      return isWithinInterval(invDate, { start, end });
    });
  }, [invoices, selectedMonth]);

  const productsBreakdown = useMemo(() => {
    const products: Record<string, ProductBreakdown> = {};
    filteredInvoices.forEach(invoice => {
      const clientName = getClientName((invoice as any).client_id);
      invoice.products?.forEach(product => {
        if (product.amount <= 0) return;
        const key = product.product_name;
        if (!products[key]) {
          products[key] = {
            name: product.product_name,
            percentage: product.percentage,
            entries: [],
            totalAmount: 0,
            totalCommission: 0,
          };
        }
        products[key].entries.push({
          ncf: invoice.ncf,
          date: invoice.invoice_date || invoice.created_at,
          amount: Number(product.amount),
          clientId: (invoice as any).client_id,
          clientName,
        });
        products[key].totalAmount += Number(product.amount);
        products[key].totalCommission += Number(product.commission);
      });
    });
    return Object.values(products).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredInvoices, clients]);

  const restBreakdown = useMemo(() => {
    const entries: ProductEntry[] = [];
    let totalAmount = 0;
    let totalCommission = 0;
    filteredInvoices.forEach(inv => {
      if (inv.rest_amount > 0) {
        const clientName = getClientName((inv as any).client_id);
        entries.push({
          ncf: inv.ncf,
          date: inv.invoice_date || inv.created_at,
          amount: Number(inv.rest_amount),
          clientId: (inv as any).client_id,
          clientName,
        });
        totalAmount += Number(inv.rest_amount);
        totalCommission += Number(inv.rest_commission);
      }
    });
    return { entries, totalAmount, totalCommission };
  }, [filteredInvoices, clients]);

  const handleUpdateGlobalPercentage = async (productName: string, newPercentage: number): Promise<boolean> => {
    try {
      for (const invoice of filteredInvoices) {
        const productToUpdate = invoice.products?.find(p => p.product_name === productName);
        if (!productToUpdate) continue;
        
        // 1. Calcular nueva comisión del producto
        const newCommission = (productToUpdate.amount * newPercentage) / 100;
        
        // 2. Actualizar producto en la tabla invoice_products
        await supabase.from('invoice_products').update({ percentage: newPercentage, commission: newCommission }).eq('invoice_id', invoice.id).eq('product_name', productName);
        
        // 3. Recalcular total de comisión de la factura
        const otherProducts = invoice.products?.filter(p => p.product_name !== productName) || [];
        const otherCommissions = otherProducts.reduce((sum, p) => sum + Number(p.commission), 0);
        const newTotalCommission = otherCommissions + newCommission + Number(invoice.rest_commission);
        
        // 4. Actualizar total en la tabla invoices
        await supabase.from('invoices').update({ total_commission: newTotalCommission }).eq('id', invoice.id);
      }
      toast.success(`Porcentaje actualizado`);
      onRefreshInvoices?.();
      return true;
    } catch (error) {
      toast.error('Error al actualizar');
      return false;
    }
  };

  const grandTotalCommission = useMemo(() => {
    return productsBreakdown.reduce((sum, p) => sum + p.totalCommission, 0) + restBreakdown.totalCommission;
  }, [productsBreakdown, restBreakdown]);

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const isCurrentMonth = selectedMonth === getMonthKey(new Date());

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateBreakdownPdf({
        month: capitalizedMonth,
        products: productsBreakdown,
        rest: restBreakdown,
        grandTotal: grandTotalCommission,
        sellerName,
      }, selectedMonth);
      toast.success('PDF generado');
    } catch (error) {
      toast.error('Error al generar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (invoices.length === 0) {
    return (
      <Card className="p-16 text-center bg-card/50 border-dashed border-border shadow-none">
        <div className="h-20 w-20 rounded-full bg-muted/30 mx-auto mb-6 flex items-center justify-center animate-pulse-soft">
          <Package className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <h3 className="font-semibold text-lg text-foreground mb-2">Sin datos disponibles</h3>
        <p className="text-muted-foreground">Guarda facturas para visualizar el desglose.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2 border-b border-border/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Desglose Mensual</h2>
            {isCurrentMonth && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary animate-in fade-in zoom-in">
                En curso
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-base">
            Análisis detallado de rendimiento por producto.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48 h-10 bg-background border-input shadow-sm hover:border-primary/50 transition-colors">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Seleccionar mes" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => {
                const [y, mo] = m.split('-').map(Number);
                const label = format(new Date(y, mo - 1, 1), 'MMMM yyyy', { locale: es });
                return (
                  <SelectItem key={m} value={m} className="capitalize">
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          {filteredInvoices.length > 0 && (
            <Button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
              variant="outline"
              className="gap-2 h-10 shadow-sm border-input hover:bg-secondary/50 hover:text-foreground"
            >
              {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              PDF
            </Button>
          )}
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <Card className="p-16 text-center bg-card/50 border-dashed border-border shadow-sm">
          <div className="h-16 w-16 rounded-full bg-muted/40 mx-auto mb-4 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <h3 className="font-semibold text-lg text-foreground mb-1">Sin actividad en {capitalizedMonth}</h3>
          <p className="text-muted-foreground">No se encontraron facturas registradas para este periodo.</p>
        </Card>
      ) : (
        <>
          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {productsBreakdown.map((product, index) => (
              <Card 
                key={product.name} 
                className="flex flex-col overflow-hidden bg-card border border-border/60 shadow-md hover:shadow-lg transition-all duration-300 group animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-b from-muted/30 to-transparent border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-white shadow-sm border border-border/50 flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-300">
                        <Package className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground leading-none mb-1.5">{product.name}</h3>
                        <span className="text-xs text-muted-foreground font-medium">{product.entries.length} facturas registradas</span>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-secondary/50 border border-secondary text-secondary-foreground font-mono text-sm font-bold shadow-sm">
                      {product.percentage}%
                    </span>
                  </div>
                </div>
                
                <div className="p-0 flex-1 flex flex-col">
                  {/* Entries List */}
                  <div className="flex-1 max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                    {product.entries.map((entry, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-3.5 rounded-xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border/30 mb-1 last:mb-0"
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                           <div className="flex flex-col min-w-0">
                              {entry.clientName ? (
                                <span className="text-sm font-semibold text-foreground truncate mb-0.5">{entry.clientName}</span>
                              ) : (
                                <span className="text-sm font-medium text-muted-foreground italic mb-0.5">Sin cliente</span>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                                <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">{entry.ncf}</span>
                                <span>•</span>
                                <span>{format(parseDateSafe(entry.date), 'd MMM', { locale: es })}</span>
                              </div>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-3 text-right">
                          <span className="font-medium text-foreground text-sm tabular-nums tracking-tight bg-background border border-border/50 px-2.5 py-1 rounded-md shadow-sm">
                            ${formatNumber(entry.amount)}
                          </span>
                          {onUpdateInvoice && onDeleteInvoice && clients && (
                            // La prop clients ya está disponible en InvoiceHistory (el padre de MonthlyBreakdown),
                            // y aquí se la pasamos a EditInvoiceDialog
                            <EditInvoiceDialog
                              invoice={filteredInvoices.find(inv => inv.ncf === entry.ncf)!}
                              onUpdate={onUpdateInvoice}
                              onDelete={onDeleteInvoice}
                              clients={clients}
                              onAddClient={clients.find(c => c.id === entry.clientId)?.id ? (() => Promise.resolve(null)) : (() => Promise.resolve(null))} // Placeholder, la prop real debe venir del contexto superior
                              onDeleteClient={() => Promise.resolve(false)} // Placeholder, la prop real debe venir del contexto superior
                              trigger={
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/5 rounded-full">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Footer Summary */}
                  <div className="mt-auto px-6 py-5 bg-gradient-to-t from-muted/20 to-transparent border-t border-border/50">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Subtotal Ventas</p>
                        <p className="text-xl font-bold text-foreground tracking-tight">${formatNumber(product.totalAmount)}</p>
                      </div>
                      
                      {/* CAJA DE COMISIÓN VERDE DESTACADA */}
                      <div className="flex items-center gap-2 bg-emerald-100/80 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-1.5 pr-4 pl-3 rounded-2xl shadow-sm">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-sm">
                           <DollarSign className="h-6 w-6" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col items-start mr-1">
                           <span className="font-bold text-xl text-emerald-800 dark:text-emerald-300 leading-none">
                             ${formatCurrency(product.totalCommission)}
                           </span>
                        </div>
                        {/* Botón de ajuste integrado (con hover fix aplicado en su componente) */}
                        <EditGlobalPercentageDialog
                          productName={product.name}
                          currentPercentage={product.percentage}
                          invoiceCount={product.entries.length}
                          month={capitalizedMonth}
                          onUpdate={(newPercentage) => handleUpdateGlobalPercentage(product.name, newPercentage)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            
            {/* Resto Card - MISMO ESTILO */}
            {restBreakdown.totalAmount > 0 && (
              <Card className="flex flex-col overflow-hidden bg-card border border-border/60 shadow-md hover:shadow-lg transition-all duration-300 group animate-slide-up">
                 <div className="px-6 py-5 bg-gradient-to-b from-secondary/20 to-transparent border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-secondary/50 border border-secondary flex items-center justify-center text-secondary-foreground group-hover:scale-105 transition-transform duration-300">
                        <Package className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground leading-none mb-1.5">Resto de Productos</h3>
                        <span className="text-xs text-muted-foreground font-medium">{restBreakdown.entries.length} facturas</span>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-secondary/30 border border-secondary/50 text-secondary-foreground font-mono text-sm font-bold shadow-sm">
                      25%
                    </span>
                  </div>
                </div>
                
                <div className="p-0 flex-1 flex flex-col">
                  <div className="flex-1 max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                    {restBreakdown.entries.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between p-3.5 rounded-xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border/30 mb-1 last:mb-0">
                         <div className="flex items-center gap-4 min-w-0 flex-1">
                           <div className="flex flex-col min-w-0">
                              {entry.clientName ? <span className="text-sm font-semibold text-foreground truncate mb-0.5">{entry.clientName}</span> : <span className="text-sm font-medium text-muted-foreground italic mb-0.5">Sin cliente</span>}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground/70"><span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">{entry.ncf}</span><span>•</span><span>{format(parseDateSafe(entry.date), 'd MMM', { locale: es })}</span></div>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <span className="font-medium text-foreground text-sm tabular-nums tracking-tight bg-background border border-border/50 px-2.5 py-1 rounded-md shadow-sm">${formatNumber(entry.amount)}</span>
                          {onUpdateInvoice && onDeleteInvoice && clients && (
                            <EditInvoiceDialog 
                              invoice={filteredInvoices.find(inv => inv.ncf === entry.ncf)!} 
                              onUpdate={onUpdateInvoice} 
                              onDelete={onDeleteInvoice} 
                              clients={clients}
                              onAddClient={clients.find(c => c.id === entry.clientId)?.id ? (() => Promise.resolve(null)) : (() => Promise.resolve(null))}
                              onDeleteClient={() => Promise.resolve(false)}
                              trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/5 rounded-full"><Pencil className="h-3.5 w-3.5" /></Button>} 
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                   <div className="mt-auto px-6 py-5 bg-gradient-to-t from-muted/20 to-transparent border-t border-border/50">
                    <div className="flex items-end justify-between gap-4">
                      <div><p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Subtotal Ventas</p><p className="text-xl font-bold text-foreground tracking-tight">${formatNumber(restBreakdown.totalAmount)}</p></div>
                      <div className="flex items-center gap-2 bg-emerald-100/80 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-1.5 pr-4 pl-3 rounded-2xl shadow-sm">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-sm"><DollarSign className="h-6 w-6" strokeWidth={2.5} /></div>
                        <div className="flex flex-col items-start mr-2"><span className="font-bold text-xl text-emerald-800 dark:text-emerald-300 leading-none">${formatCurrency(restBreakdown.totalCommission)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Elegant Commission Summary Box (MATH STYLE RESTORED & IMPROVED) */}
          <div className="mt-8">
            <Card className="p-8 bg-gradient-to-b from-white to-slate-50 border border-border shadow-md rounded-2xl">
              {/* Products Row with + signs */}
              <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
                {productsBreakdown.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-3">
                    <div className="px-5 py-3 rounded-xl bg-white rounded-xl border border-border/60 shadow-sm min-w-[160px] transform hover:-translate-y-1 transition-transform duration-300">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">{product.name}</p>
                      <p className="font-bold text-lg text-foreground">${formatCurrency(product.totalCommission)}</p>
                    </div>
                    {(index < productsBreakdown.length - 1 || restBreakdown.totalAmount > 0) && <span className="text-3xl font-light text-muted-foreground/30">+</span>}
                  </div>
                ))}
                
                {/* Rest box */}
                {restBreakdown.totalAmount > 0 && (
                  <div className="px-5 py-3 rounded-xl bg-white rounded-xl border border-border/60 shadow-sm min-w-[160px] transform hover:-translate-y-1 transition-transform duration-300">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Resto (25%)</p>
                    <p className="font-bold text-lg text-foreground">${formatCurrency(restBreakdown.totalCommission)}</p>
                  </div>
                )}
              </div>
              
              {/* Separator Line with = */}
              <div className="flex items-center justify-center gap-6 my-6 opacity-40">
                <div className="w-24 h-[2px] bg-foreground/20 rounded-full" />
                <span className="text-4xl text-foreground/40 font-light">=</span>
                <div className="w-24 h-[2px] bg-foreground/20 rounded-full" />
              </div>
              
              {/* Grand Total */}
              <div className="text-center animate-fade-in scale-100 hover:scale-105 transition-transform duration-500">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.3em] mb-4">
                  Comisión Total — {capitalizedMonth}
                </p>
                <div className="inline-block relative">
                  <span className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-xl rounded-full opacity-50"></span>
                  <p className="relative text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 drop-shadow-sm">
                    ${formatCurrency(grandTotalCommission)}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
