import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, CalendarIcon, Save, Trash2, Plus, X } from 'lucide-react';
import { formatNumber, parseDateSafe, formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Invoice } from '@/hooks/useInvoices';
import { Product, useProducts } from '@/hooks/useProducts';
import { Client } from '@/hooks/useClients'; // Importamos el tipo Client
import { ClientSelector } from './ClientSelector'; // Importamos el selector

interface EditInvoiceDialogProps {
  invoice: Invoice;
  onUpdate: (
    id: string,
    ncf: string,
    invoiceDate: string,
    totalAmount: number,
    restAmount: number,
    restPercentage: number,
    restCommission: number,
    totalCommission: number,
    products: { name: string; amount: number; percentage: number; commission: number }[],
    clientId?: string | null // Añadimos el ID del cliente al update
  ) => Promise<any>;
  onDelete: (id: string) => Promise<boolean>;
  trigger?: React.ReactNode;
  // Nuevas dependencias inyectadas por el padre
  clients: Client[];
  onAddClient: (name: string, phone?: string, email?: string) => Promise<Client | null>;
  onDeleteClient: (id: string) => Promise<boolean>;
}

export const EditInvoiceDialog = ({ invoice, onUpdate, onDelete, trigger, clients, onAddClient, onDeleteClient }: EditInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  const [ncfSuffix, setNcfSuffix] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [totalAmount, setTotalAmount] = useState(0);
  const [products, setProducts] = useState<{ name: string; amount: number; percentage: number; commission: number }[]>([]);
  const [restPercentage, setRestPercentage] = useState(25);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null); // Nuevo estado para el cliente
  
  // For adding new products
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPercentage, setNewProductPercentage] = useState(15);
  const [newProductAmount, setNewProductAmount] = useState(0);
  
  const { products: catalogProducts = [] } = useProducts();

  const ncfPrefix = 'B010000';

  useEffect(() => {
    if (open) {
      const suffix = invoice.ncf.slice(-4);
      setNcfSuffix(suffix);
      setInvoiceDate(parseDateSafe(invoice.invoice_date || invoice.created_at));
      setTotalAmount(invoice.total_amount);
      setRestPercentage(invoice.rest_percentage || 25);
      
      // Asignar cliente inicial
      const initialClient = clients.find(c => c.id === invoice.client_id) || null;
      setSelectedClient(initialClient);
      
      const prods = invoice.products?.map(p => ({
        name: p.product_name,
        amount: p.amount,
        percentage: p.percentage,
        commission: p.commission,
      })) || [];
      setProducts(prods);
      setDeleteConfirm(false);
      setShowAddProduct(false);
    }
  }, [open, invoice, clients]);

  const handleProductAmountChange = (index: number, value: string) => {
    const numValue = parseInt(value.replace(/,/g, ''), 10) || 0;
    const newProducts = [...products];
    newProducts[index].amount = numValue;
    newProducts[index].commission = numValue * (newProducts[index].percentage / 100);
    setProducts(newProducts);
  };

  const handleProductPercentageChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newProducts = [...products];
    newProducts[index].percentage = numValue;
    newProducts[index].commission = newProducts[index].amount * (numValue / 100);
    setProducts(newProducts);
  };

  const handleRemoveProduct = (index: number) => {
    const newProducts = [...products];
    newProducts.splice(index, 1);
    setProducts(newProducts);
  };

  const handleAddNewProduct = () => {
    if (!newProductName.trim()) return;
    
    const newProduct = {
      name: newProductName.trim(),
      amount: newProductAmount,
      percentage: newProductPercentage,
      commission: newProductAmount * (newProductPercentage / 100),
    };
    
    setProducts([...products, newProduct]);
    setNewProductName('');
    setNewProductPercentage(15);
    setNewProductAmount(0);
    setShowAddProduct(false);
  };

  const handleAddFromCatalog = (catalogProduct: Product) => {
    const existingIndex = products.findIndex(p => p.name === catalogProduct.name);
    if (existingIndex >= 0) {
      return;
    }
    
    const newProduct = {
      name: catalogProduct.name,
      amount: 0,
      percentage: catalogProduct.percentage,
      commission: 0,
    };
    
    setProducts([...products, newProduct]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ncfSuffix.length !== 4) return;
    
    setLoading(true);
    
    const fullNcf = `${ncfPrefix}${ncfSuffix.padStart(4, '0')}`;
    const productsTotal = products.reduce((sum, p) => sum + p.amount, 0);
    const productsCommission = products.reduce((sum, p) => sum + p.commission, 0);
    const restAmount = Math.max(0, totalAmount - productsTotal);
    const restCommission = restAmount * (restPercentage / 100);
    const totalCommission = productsCommission + restCommission;
    
    const result = await onUpdate(
      invoice.id,
      fullNcf,
      format(invoiceDate, 'yyyy-MM-dd'),
      totalAmount,
      restAmount,
      restPercentage,
      restCommission,
      totalCommission,
      products,
      selectedClient?.id // Pasar el ID del cliente
    );
    
    setLoading(false);
    if (result) {
      setOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    
    setLoading(true);
    const result = await onDelete(invoice.id);
    setLoading(false);
    if (result) {
      setOpen(false);
    }
  };

  const productsTotal = products.reduce((sum, p) => sum + p.amount, 0);
  const restAmount = Math.max(0, totalAmount - productsTotal);
  const productsCommission = products.reduce((sum, p) => sum + p.commission, 0);
  const restCommission = restAmount * (restPercentage / 100);
  const calculatedTotalCommission = productsCommission + restCommission;

  const availableCatalogProducts = catalogProducts.filter(
    cp => !products.some(p => p.name === cp.name)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2 hover:bg-muted/80">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Editar Factura: {invoice.ncf}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          
          {/* Cliente Selector */}
          <div className="space-y-2 pt-2 pb-1 border-b border-border/40">
             <Label className="text-sm font-medium">Cliente</Label>
             <ClientSelector
                clients={clients}
                selectedClient={selectedClient}
                onSelectClient={setSelectedClient}
                onAddClient={onAddClient}
                onDeleteClient={onDeleteClient}
             />
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fecha de la Factura</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-12 border-input hover:bg-muted/50",
                    !invoiceDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
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
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* NCF Input */}
          <div className="space-y-2">
            <Label htmlFor="ncf" className="text-sm font-medium">NCF (últimos 4 dígitos)</Label>
            <div className="flex items-center rounded-lg border border-input bg-muted/20 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
              <span className="px-3 py-3 text-lg font-mono font-medium text-muted-foreground bg-muted/50 border-r border-input">
                {ncfPrefix}
              </span>
              <Input
                id="ncf"
                value={ncfSuffix}
                onChange={(e) => setNcfSuffix(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder="0000"
                className="border-0 text-lg font-mono font-bold text-center focus-visible:ring-0 shadow-none bg-transparent"
                maxLength={4}
                inputMode="numeric"
                required
              />
            </div>
          </div>

          {/* Total Amount */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Total Factura</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground group-focus-within:text-primary transition-colors">
                $
              </span>
              <Input
                type="text"
                inputMode="numeric"
                value={totalAmount > 0 ? formatNumber(totalAmount) : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '');
                  setTotalAmount(parseInt(raw, 10) || 0);
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                className="h-14 pl-9 text-2xl font-bold bg-muted/10 border-input focus:bg-background transition-all"
                placeholder="0"
              />
            </div>
          </div>

          {/* Products */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Productos Variables</Label>
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="gap-1.5 h-8 text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            
            {/* Add Product Form */}
            {showAddProduct && (
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">Nombre</Label>
                    <Input
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="Ej: Vitamina D"
                      className="h-9 bg-background"
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Comisión (%)</Label>
                    <Input
                      type="number"
                      value={newProductPercentage}
                      onChange={(e) => setNewProductPercentage(Number(e.target.value))}
                      className="h-9 bg-background"
                      min={0}
                      max={100}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Monto ($)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={newProductAmount > 0 ? formatNumber(newProductAmount) : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, '');
                        setNewProductAmount(parseInt(raw, 10) || 0);
                      }}
                      className="h-9 bg-background"
                      placeholder="0"
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </div>
                </div>
                
                {/* Quick add from catalog */}
                {availableCatalogProducts.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">Catálogo</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableCatalogProducts.slice(0, 5).map(cp => (
                        <Button
                          key={cp.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddFromCatalog(cp)}
                          className="h-7 text-xs gap-1.5 border-dashed"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cp.color }}></span>
                          {cp.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddProduct(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddNewProduct}
                    disabled={!newProductName.trim()}
                    className="flex-1 gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar
                  </Button>
                </div>
              </div>
            )}
            
            {/* Product List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {products.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40 shadow-sm transition-all hover:border-border/80 group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative">
                      <Input
                        type="number"
                        value={product.percentage}
                        onChange={(e) => handleProductPercentageChange(index, e.target.value)}
                        className="w-14 h-8 text-center text-xs font-bold bg-muted/30 border-transparent hover:bg-muted/50 focus:border-primary focus:bg-background transition-all p-0"
                        min={0}
                        max={100}
                      />
                      <span className="absolute -right-2 top-1 text-[10px] text-muted-foreground">%</span>
                    </div>
                    <span className="text-sm font-medium truncate text-foreground/90">{product.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={product.amount > 0 ? formatNumber(product.amount) : ''}
                        onChange={(e) => handleProductAmountChange(index, e.target.value)}
                        className="h-9 pl-6 text-sm text-right font-medium bg-background"
                        placeholder="0"
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={() => handleRemoveProduct(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rest Percentage */}
          <div className="grid grid-cols-2 gap-4 items-center p-3 rounded-lg bg-secondary/20">
            <Label className="text-sm text-muted-foreground">Porcentaje Resto (%)</Label>
            <Input
              type="number"
              value={restPercentage}
              onChange={(e) => setRestPercentage(Number(e.target.value))}
              className="h-9 bg-background text-right font-medium"
              min={0}
              max={100}
            />
          </div>

          {/* Summary */}
          <div className="p-5 rounded-xl bg-muted/30 border border-border/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal Productos</span>
              <span className="font-medium text-foreground">${formatNumber(productsTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal Resto</span>
              <span className="font-medium text-foreground">${formatNumber(restAmount)}</span>
            </div>
            <div className="my-2 border-t border-dashed border-border/60"></div>
            <div className="flex justify-between text-base font-bold pt-1">
              <span>Comisión Total</span>
              <span className="text-success text-lg">${formatCurrency(calculatedTotalCommission)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant={deleteConfirm ? "destructive" : "outline"}
              onClick={handleDelete}
              disabled={loading}
              className="gap-2 px-4 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              {deleteConfirm ? 'Confirmar' : 'Eliminar'}
            </Button>
            <div className="flex-1 flex gap-3 justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || ncfSuffix.length !== 4}
                className="min-w-[120px] gap-2 gradient-primary shadow-md hover:shadow-lg transition-all"
              >
                {loading ? (
                  'Guardando...'
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Guardar
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};