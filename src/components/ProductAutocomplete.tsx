import { useState, useRef, useEffect } from 'react';
import { formatNumber } from '@/lib/formatters';
import { Trash2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditProductDialog } from '@/components/EditProductDialog';

interface Product {
  id: string;
  name: string;
  percentage: number;
  color: string;
  is_default: boolean;
}

interface ProductAutocompleteProps {
  products: Product[];
  productAmounts: Record<string, number>;
  productDisplayValues: Record<string, string>;
  onProductChange: (id: string, value: string) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
}

export const ProductAutocomplete = ({
  products,
  productAmounts,
  productDisplayValues,
  onProductChange,
  onDeleteProduct,
  onUpdateProduct,
}: ProductAutocompleteProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const selectedProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null;

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Buscar producto..."
          className="w-full h-10 px-4 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        
        {/* Suggestions Dropdown */}
        {showSuggestions && searchTerm && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <span 
                    className="h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                    style={{ backgroundColor: product.color }}
                  >
                    {product.percentage}%
                  </span>
                  <span className="text-sm font-medium text-foreground">{product.name}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No se encontraron productos
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product List */}
      <div className="space-y-2">
        {products.map((product) => {
          const amount = productAmounts[product.id] || 0;
          const commission = amount * (product.percentage / 100);
          
          return (
            <div 
              key={product.id}
              className="group flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
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
                  <EditProductDialog 
                    product={product}
                    onUpdate={onUpdateProduct}
                  />
                  {!product.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onDeleteProduct(product.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                {amount > 0 && (
                  <span className="text-xs font-medium" style={{ color: product.color }}>
                    +${commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <input
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
        })}
      </div>
    </div>
  );
};
