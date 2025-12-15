import { useState, useRef, useEffect } from 'react';
import { formatNumber } from '@/lib/formatters';
import { Trash2, Plus, Search, X, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EditProductDialog } from '@/components/EditProductDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Product {
  id: string;
  name: string;
  percentage: number;
  color: string;
  is_default: boolean;
}

interface ProductManagerProps {
  // Productos que están ACTUALMENTE en la factura (copia local)
  activeProducts: Product[];
  // Catálogo completo para buscar y agregar
  catalogProducts: Product[];
  
  productAmounts: Record<string, number>;
  productDisplayValues: Record<string, string>;
  
  onProductChange: (id: string, value: string) => void;
  // Acción de quitar de la factura (NO borrar de DB)
  onRemoveFromInvoice: (id: string) => void;
  // Acción de editar el producto localmente en la factura (opcional)
  onUpdateLocalProduct: (id: string, updates: Partial<Product>) => void;
  // Acción de agregar del catálogo a la factura
  onAddToInvoice: (product: Product) => void;
  // Acción de crear nuevo en DB y agregar a factura
  onCreateAndAdd: (name: string, percentage: number) => Promise<any>;
}

export const ProductManager = ({
  activeProducts,
  catalogProducts,
  productAmounts,
  productDisplayValues,
  onProductChange,
  onRemoveFromInvoice,
  onUpdateLocalProduct,
  onAddToInvoice,
  onCreateAndAdd,
}: ProductManagerProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPercentage, setNewProductPercentage] = useState(15);
  const [addLoading, setAddLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtramos el catálogo global para las sugerencias
  // Excluimos los que ya están en la factura para no duplicar visualmente si no se desea
  const activeIds = new Set(activeProducts.map(p => p.id));
  const filteredCatalog = catalogProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !activeIds.has(p.id)
  );

  // Si no hay resultados en catálogo y hay término de búsqueda
  const noResults = searchTerm.length > 0 && filteredCatalog.length === 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) return;
    
    setAddLoading(true);
    // Este crea en DB y lo devuelve para agregarlo a la lista local automáticamente
    const result = await onCreateAndAdd(newProductName.trim(), newProductPercentage);
    setAddLoading(false);
    
    if (result) {
      setNewProductName('');
      setNewProductPercentage(15);
      setShowAddDialog(false);
      setSearchTerm('');
    }
  };

  const handleCreateFromSearch = () => {
    setNewProductName(searchTerm);
    setShowAddDialog(true);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-3">
      {/* Search Input with integrated actions */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Buscar en catálogo para agregar..."
            className="w-full h-10 pl-10 pr-10 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setShowSuggestions(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Suggestions Dropdown (CATÁLOGO) */}
        {showSuggestions && (searchTerm || filteredCatalog.length > 0) && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto animate-in fade-in-0 zoom-in-95">
            {filteredCatalog.length > 0 ? (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/30 sticky top-0 backdrop-blur-sm">
                  Resultados del Catálogo
                </div>
                {filteredCatalog.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      onAddToInvoice(product);
                      setSearchTerm('');
                      setShowSuggestions(false);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left border-b border-border/50 last:border-b-0 group"
                  >
                    <span 
                      className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                      style={{ backgroundColor: product.color }}
                    >
                      {product.percentage}%
                    </span>
                    <span className="text-sm font-medium text-foreground flex-1">{product.name}</span>
                    <Plus className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </>
            ) : null}
            
            {/* Create new product option */}
            {noResults && (
              <button
                onClick={handleCreateFromSearch}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-primary/10 transition-colors text-left bg-muted/30"
              >
                <div className="h-7 w-7 rounded bg-primary/20 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">Crear "{searchTerm}"</span>
                  <span className="text-xs text-muted-foreground ml-2">y agregar a la factura</span>
                </div>
              </button>
            )}
            
            {/* Always show add button at bottom if looking for something specific */}
            {!noResults && searchTerm && (
              <button
                onClick={() => {
                  setShowAddDialog(true);
                  setShowSuggestions(false);
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-primary/10 transition-colors text-left border-t border-border"
              >
                <Plus className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Crear nuevo producto</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invoice Product List (LOCAL) */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
        {activeProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
            <PackageOpen className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No hay productos seleccionados</p>
            <p className="text-xs opacity-70">Busca arriba para agregar</p>
          </div>
        ) : (
          activeProducts.map((product, index) => {
            const amount = productAmounts[product.id] || 0;
            const commission = amount * (product.percentage / 100);
            
            return (
              <div 
                key={product.id}
                className="group flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-all duration-200 hover-lift border border-transparent hover:border-border/50"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div 
                  className="h-8 w-8 rounded flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0"
                  style={{ backgroundColor: product.color }}
                >
                  {product.percentage}%
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground truncate">{product.name}</span>
                    {/* El EditDialog aquí actualizará solo la copia LOCAL o Global dependiendo de lo que pasemos en onUpdateLocalProduct */}
                    <EditProductDialog 
                      product={product}
                      onUpdate={async (id, updates) => {
                        onUpdateLocalProduct(id, updates);
                        return true;
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveFromInvoice(product.id)}
                      title="Quitar de la factura"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {amount > 0 && (
                    <span className="text-xs font-medium" style={{ color: product.color }}>
                      +${commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <input
                    id={`product-input-${product.id}`}
                    type="text"
                    inputMode="numeric"
                    value={productDisplayValues[product.id] || (amount > 0 ? formatNumber(amount) : '')}
                    onChange={(e) => onProductChange(product.id, e.target.value)}
                    className="w-full h-8 pl-5 pr-2 text-sm text-right font-medium rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear y Agregar Producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Producto</Label>
              <Input
                id="name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Ej: Vitamina D"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="percentage">Porcentaje de Comisión (%)</Label>
              <Input
                id="percentage"
                type="number"
                min={0}
                max={100}
                value={newProductPercentage}
                onChange={(e) => setNewProductPercentage(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateProduct} 
                disabled={addLoading || !newProductName.trim()}
                className="gradient-primary"
              >
                {addLoading ? 'Creando...' : 'Crear y Agregar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};