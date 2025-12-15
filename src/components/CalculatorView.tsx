import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw, Calculator, DollarSign, Check, Package, CalendarIcon, FileText, CheckCircle2, BellRing, User, X } from "lucide-react";
import { EditRestPercentageDialog } from "@/components/EditRestPercentageDialog";
import { BreakdownTable } from "@/components/BreakdownTable";
import { ProductManager } from "@/components/ProductManager";
import { ProductCatalogDialog } from "@/components/ProductCatalogDialog";
import { ClientSelector } from "@/components/ClientSelector";
import { SaveSuccessAnimation } from "@/components/SaveSuccessAnimation";
import { formatNumber, formatCurrency, parseDateSafe } from "@/lib/formatters"; 
import { format, isToday, isYesterday } from "date-fns";
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Invoice } from "@/hooks/useInvoices";
import { Client } from "@/hooks/useClients";
import { Seller } from "@/hooks/useSellers";

interface Product {
  id: string;
  name: string;
  percentage: number;
  color: string;
  is_default: boolean;
}

interface Breakdown {
  name: string;
  label: string;
  amount: number;
  percentage: number;
  commission: number;
  color: string;
}

interface Calculations {
  breakdown: Breakdown[];
  restAmount: number;
  restCommission: number;
  totalCommission: number;
}

interface CalculatorViewProps {
  products: Product[];
  productAmounts: Record<string, number>;
  totalInvoice: number;
  setTotalInvoice: (value: number) => void;
  calculations: Calculations;
  restPercentage: number;
  isLoading: boolean;
  onProductChange: (id: string, value: number) => void;
  onReset: () => void;
  onAddProduct: (name: string, percentage: number) => Promise<any>;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  onDeleteProduct: (id: string) => void;
  onUpdateRestPercentage: (value: number) => Promise<boolean>;
  onSaveInvoice: (ncf: string, invoiceDate: string, clientId?: string) => Promise<any>;
  suggestedNcf?: number | null;
  lastInvoice?: Invoice;
  clients: Client[];
  onAddClient: (name: string, phone?: string, email?: string) => Promise<Client | null>;
  onDeleteClient?: (id: string) => Promise<boolean>;
  activeSeller?: Seller | null;
}

export const CalculatorView = ({
  products: catalogProducts = [], 
  productAmounts,
  totalInvoice,
  setTotalInvoice,
  calculations: initialCalculations,
  restPercentage,
  isLoading,
  onProductChange,
  onReset,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateRestPercentage,
  onSaveInvoice,
  suggestedNcf,
  lastInvoice,
  clients = [],
  onAddClient,
  onDeleteClient,
  activeSeller,
}: CalculatorViewProps) => {
  const [displayValue, setDisplayValue] = useState(totalInvoice > 0 ? formatNumber(totalInvoice) : '');
  const [productDisplayValues, setProductDisplayValues] = useState<Record<string, string>>({});
  
  const [activeProducts, setActiveProducts] = useState<Product[]>([]); 
  
  const [ncfSuffix, setNcfSuffix] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [step1Complete, setStep1Complete] = useState(false);
  const [step2Complete, setStep2Complete] = useState(false);
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);
  const toastShownRef = useRef(false);

  const ncfPrefix = 'B010000';

  useEffect(() => {
    if (activeProducts.length === 0 && catalogProducts.length > 0 && !step1Complete) {
      const defaults = catalogProducts.filter(p => p.is_default);
      if (defaults.length > 0) {
        setActiveProducts(defaults);
      }
    }
  }, [catalogProducts]);

  useEffect(() => {
    if (suggestedNcf !== null && suggestedNcf !== undefined) {
      setNcfSuffix(String(suggestedNcf).padStart(4, '0'));
    }
  }, [suggestedNcf]);

  const localCalculations = (() => {
    const breakdown = activeProducts.map((product) => ({
      name: product.name,
      label: product.name,
      amount: productAmounts[product.id] || 0,
      percentage: product.percentage,
      commission: (productAmounts[product.id] || 0) * (product.percentage / 100),
      color: product.color,
    }));

    const specialProductsTotal = breakdown.reduce((sum, item) => sum + item.amount, 0);
    const safeTotal = Number(totalInvoice) || 0;
    const restAmount = Math.max(0, safeTotal - specialProductsTotal);
    const restCommission = restAmount * (Number(restPercentage) / 100);
    const totalCommission = breakdown.reduce((sum, item) => sum + item.commission, 0) + restCommission;

    return { breakdown, restAmount, restCommission, totalCommission };
  })();

  const handleAddToInvoice = (product: Product) => {
    if (!activeProducts.find(p => p.id === product.id)) {
      setActiveProducts(prev => [...prev, product]);
      toast.success(`${product.name} agregado`);
    } else {
      toast.info(`${product.name} ya está agregado`);
    }
  };

  const handleCreateAndAddToInvoice = async (name: string, percentage: number) => {
    const newProduct = await onAddProduct(name, percentage);
    if (newProduct) {
      handleAddToInvoice(newProduct);
    }
    return newProduct;
  };

  const handleRemoveFromInvoice = (id: string) => {
    setActiveProducts(prev => prev.filter(p => p.id !== id));
    onProductChange(id, 0); 
  };

  const handleUpdateLocalProduct = (id: string, updates: Partial<Product>) => {
    setActiveProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };
  
  // --- Toast de Última Factura (NUEVO DISEÑO) ---
  useEffect(() => {
    if (lastInvoice && !toastShownRef.current && lastInvoice.ncf) {
      try {
        // Usar new Date(lastInvoice.created_at) para obtener el timestamp real
        const creationDate = new Date(lastInvoice.created_at); 
        
        if (isNaN(creationDate.getTime())) throw new Error("Invalid creation date");

        const safeTotal = Number(lastInvoice.total_amount) || 0;
        const safeCommission = Number(lastInvoice.total_commission) || 0;

        // Determinar etiqueta de día (Ayer, Hoy, o fecha corta)
        let dayLabel: string;
        if (isToday(creationDate)) {
          dayLabel = 'Hoy';
        } else if (isYesterday(creationDate)) {
          dayLabel = 'Ayer';
        } else {
          dayLabel = format(creationDate, 'd MMM', { locale: es });
        }
        
        // Formatear hora (7:22pm)
        const timeLabel = format(creationDate, 'h:mma', { locale: es }).toLowerCase().replace(/\s/g, ''); // 7:22pm

        toast.custom((t) => (
          // [MODIFICADO] Aumentado a max-w-xl
          <div className="w-full max-w-xl bg-white dark:bg-slate-950 border border-primary/40 rounded-xl shadow-xl p-4 flex gap-4 items-center animate-in slide-in-from-bottom-5 duration-500">
            
            {/* Left Section: Icon */}
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            
            {/* Center Section: Info */}
            <div className="flex-1 min-w-0">
               {/* Titulo y Fecha */}
               <div className="flex items-center justify-between mb-0.5">
                 <h4 className="font-semibold text-base text-foreground">Última Factura</h4>
                 <p className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                     {dayLabel}, <span className="font-mono text-foreground/80">({timeLabel})</span>
                 </p>
               </div>

               {/* NCF y Montos */}
               <div className="flex justify-between items-center bg-muted/20 p-2.5 rounded-lg border border-border/40">
                    <p className="font-mono text-sm text-foreground tracking-wider font-medium mr-4">{lastInvoice.ncf}</p>
                    <div className="flex items-center gap-3 text-right">
                       <div className="text-sm">
                           <span className="text-muted-foreground mr-1 text-xs">Monto:</span>
                           <span className="font-semibold text-foreground">${formatNumber(safeTotal)}</span>
                       </div>
                       <div className="text-sm">
                            <span className="text-muted-foreground mr-1 text-xs">Comisión:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                ${formatNumber(safeCommission)}
                            </span>
                       </div>
                    </div>
               </div>
            </div>
            
            {/* Right Section: Close Button */}
            <button 
              onClick={() => toast.dismiss(t)} 
              className="p-1 rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors shrink-0 self-start"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ), { duration: 6000, position: 'bottom-left' }); 
        
        toastShownRef.current = true;
      } catch (error) {
        console.error("Error mostrando toast:", error);
      }
    }
  }, [lastInvoice]);

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw && !/^\d*$/.test(raw)) return; 
    
    const numValue = parseInt(raw, 10) || 0;
    setTotalInvoice(numValue);
    if (numValue > 0) setDisplayValue(formatNumber(numValue));
    else setDisplayValue('');
  };

  const handleProductAmountChange = (id: string, value: string) => {
    const raw = value.replace(/,/g, '');
    if (raw && !/^\d*$/.test(raw)) return;
    const numValue = parseInt(raw, 10) || 0;
    onProductChange(id, numValue);
    if (numValue > 0) setProductDisplayValues(prev => ({ ...prev, [id]: formatNumber(numValue) }));
    else setProductDisplayValues(prev => ({ ...prev, [id]: '' }));
  };

  const handleReset = useCallback(() => {
    setDisplayValue('');
    setProductDisplayValues({});
    setNcfSuffix('');
    setInvoiceDate(new Date());
    setSelectedClient(null);
    setStep1Complete(false);
    setStep2Complete(false);
    
    const defaults = catalogProducts.filter(p => p.is_default);
    setActiveProducts(defaults);
    
    onReset();
    toastShownRef.current = false;
  }, [onReset, catalogProducts]);

  const handleNcfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setNcfSuffix(value);
  };

  const handleContinueStep1 = () => {
    if (ncfSuffix.length === 4) setStep1Complete(true);
  };

  const handleContinueStep2 = () => {
    if (selectedClient) setStep2Complete(true);
  };

  const handleSaveInvoice = async () => {
    setShowSaveAnimation(true);
    const fullNcf = `${ncfPrefix}${ncfSuffix.padStart(4, '0')}`;
    try {
      await onSaveInvoice(fullNcf, format(invoiceDate, 'yyyy-MM-dd'), selectedClient?.id);
    } catch (e) {
      console.error(e);
      setShowSaveAnimation(false);
      toast.error("Error al guardar");
    }
  };

  const handleAnimationComplete = useCallback(() => {
    setShowSaveAnimation(false);
    handleReset();
  }, [handleReset]);

  const fullNcf = `${ncfPrefix}${ncfSuffix.padStart(4, '0')}`;
  const hasResult = totalInvoice > 0;
  const canProceedStep1 = ncfSuffix.length === 4;
  const canProceedStep2 = selectedClient !== null;
  const showBreakdown = step1Complete && step2Complete && hasResult;

  return (
    <div className="animate-fade-in">
      <SaveSuccessAnimation show={showSaveAnimation} onComplete={handleAnimationComplete} />
      
      <div className={`grid gap-6 ${showBreakdown ? 'lg:grid-cols-2' : 'max-w-xl mx-auto'}`}>
        <Card className="overflow-hidden card-shadow hover-lift">
          <div className="gradient-primary px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-primary-foreground">Calculadora</h1>
                <p className="text-primary-foreground/70 text-sm">
                  {activeSeller ? `Comisiones de ${activeSeller.name}` : 'Calcula tu ganancia'}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-border">
            <div className="p-5">
              <div 
                className={`flex items-center gap-2 mb-4 ${step1Complete ? 'cursor-pointer hover:opacity-80' : ''}`} 
                onClick={() => step1Complete && setStep1Complete(false)}
              >
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step1Complete ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'
                }`}>
                  {step1Complete ? <Check className="h-4 w-4" /> : '1'}
                </div>
                <h3 className="font-semibold text-foreground">Datos de la Factura</h3>
                {step1Complete && (
                  <span className="ml-auto text-xs text-success flex items-center gap-1 font-medium bg-success/10 px-2 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 
                    {fullNcf} • {format(invoiceDate, "d MMM", { locale: es })}
                  </span>
                )}
              </div>

              {!step1Complete && (
                <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className={cn(
                            "w-full justify-start text-left font-normal h-11", 
                            !invoiceDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {invoiceDate ? format(invoiceDate, "d 'de' MMMM, yyyy", { locale: es }) : <span>Seleccionar fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar 
                          mode="single" 
                          selected={invoiceDate} 
                          onSelect={(date) => date && setInvoiceDate(date)} 
                          initialFocus 
                          locale={es} 
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>NCF (últimos 4)</Label>
                    <div className="flex items-center rounded-lg border border-border bg-muted/30 overflow-hidden">
                      <span className="px-3 py-2.5 text-base font-mono font-medium text-muted-foreground bg-muted border-r border-border">
                        {ncfPrefix}
                      </span>
                      <Input 
                        value={ncfSuffix} 
                        onChange={handleNcfChange} 
                        placeholder="0000" 
                        className="border-0 text-base font-mono font-bold text-center focus-visible:ring-0 h-11" 
                        maxLength={4} 
                        inputMode="numeric" 
                      />
                    </div>
                  </div>
                  
                  <Button onClick={handleContinueStep1} disabled={!canProceedStep1} className="w-full h-11 gradient-primary">
                    Continuar
                  </Button>
                </div>
              )}
            </div>
          </div>

          {step1Complete && (
            <div className="border-b border-border animate-in slide-in-from-bottom-2 fade-in duration-300">
              <div className="p-5">
                <div 
                  className={`flex items-center gap-2 mb-4 ${step2Complete ? 'cursor-pointer hover:opacity-80' : ''}`}
                  onClick={() => step2Complete && setStep2Complete(false)}
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step2Complete ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'
                  }`}>
                    {step2Complete ? <Check className="h-4 w-4" /> : '2'}
                  </div>
                  <h3 className="font-semibold text-foreground">Cliente</h3>
                  {step2Complete && selectedClient && (
                    <span className="ml-auto text-xs text-success flex items-center gap-1 font-medium bg-success/10 px-2 py-1 rounded-full">
                      <User className="h-3.5 w-3.5" />
                      {selectedClient.name}
                    </span>
                  )}
                </div>
                
                {!step2Complete && (
                  <div className="space-y-4">
                    <ClientSelector
                      clients={clients}
                      selectedClient={selectedClient}
                      onSelectClient={setSelectedClient}
                      onAddClient={onAddClient}
                      onDeleteClient={deleteClient}
                    />
                    
                    <Button 
                      onClick={handleContinueStep2} 
                      disabled={!canProceedStep2} 
                      className="w-full h-11 gradient-primary"
                    >
                      Continuar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step1Complete && step2Complete && (
            <>
              <div className="p-5 border-b border-border animate-in slide-in-from-bottom-2 fade-in duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    hasResult ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'
                  }`}>
                    {hasResult ? <Check className="h-4 w-4" /> : '3'}
                  </div>
                  <h3 className="font-semibold text-foreground">Total de la Factura</h3>
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">$</span>
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    value={displayValue} 
                    onChange={handleTotalChange} 
                    className="w-full h-14 pl-9 pr-4 text-2xl font-bold rounded-lg border bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" 
                    placeholder="0" 
                  />
                </div>
              </div>

              {hasResult && (
                <div className="border-b border-border">
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-accent/10 flex items-center justify-center">
                          <Package className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">Productos Variables</h3>
                      </div>
                      
                      <ProductCatalogDialog 
                        products={catalogProducts}
                        onUpdateProduct={onUpdateProduct}
                        onDeleteProduct={deleteProduct}
                        onAddProduct={addProduct}
                      />
                    </div>
                    
                    {isLoading ? (
                      <div className="h-12 bg-muted animate-pulse rounded-lg" />
                    ) : (
                      <ProductManager
                        activeProducts={activeProducts}
                        catalogProducts={catalogProducts}
                        productAmounts={productAmounts}
                        productDisplayValues={productDisplayValues}
                        onProductChange={handleProductAmountChange}
                        onRemoveFromInvoice={handleRemoveFromInvoice}
                        onUpdateLocalProduct={handleUpdateLocalProduct}
                        onAddToInvoice={handleAddToInvoice}
                        onCreateAndAdd={handleCreateAndAddToInvoice}
                      />
                    )}
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 text-sm mt-3">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {restPercentage}%
                        </span>
                        <span className="text-muted-foreground">Resto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">${formatNumber(localCalculations.restAmount)}</span>
                        <EditRestPercentageDialog currentValue={restPercentage} onUpdate={onUpdateRestPercentage} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {hasResult && (
                <div className="p-5 gradient-success lg:hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-success-foreground/80 mb-0.5">Comisión total</p>
                      <p className="text-3xl font-bold text-success-foreground">${formatCurrency(localCalculations.totalCommission)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-success-foreground/20 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-success-foreground" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {showBreakdown && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700">
            <BreakdownTable 
              totalInvoice={totalInvoice} 
              breakdown={localCalculations.breakdown} 
              restAmount={localCalculations.restAmount} 
              restPercentage={restPercentage} 
              restCommission={localCalculations.restCommission} 
              totalCommission={localCalculations.totalCommission} 
            />
            <div className="flex gap-3 animate-slide-up">
              <Button 
                className="flex-1 gap-2 h-12 text-base gradient-primary" 
                disabled={totalInvoice === 0} 
                onClick={handleSaveInvoice}
              >
                <FileText className="h-5 w-5" /> Guardar Factura
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2 h-11 flex-1">
                <RotateCcw className="h-4 w-4" /> Limpiar
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {!step1Complete && (
        <div className="max-w-xl mx-auto mt-4">
          <p className="text-center text-muted-foreground text-sm">
            Ingresa la fecha y el NCF para comenzar
          </p>
        </div>
      )}

      {step1Complete && !step2Complete && (
        <div className="max-w-xl mx-auto mt-4">
          <p className="text-center text-muted-foreground text-sm">
            Selecciona un cliente para continuar
          </p>
        </div>
      )}
    </div>
  );
};
