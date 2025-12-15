import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  percentage: number;
  color: string;
  is_default: boolean;
}

interface EditProductDialogProps {
  product: Product;
  onUpdate: (id: string, updates: Partial<Product>) => Promise<boolean>;
}

export const EditProductDialog = ({ product, onUpdate }: EditProductDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [percentage, setPercentage] = useState(product.percentage);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    const result = await onUpdate(product.id, { name: name.trim(), percentage });
    setLoading(false);
    
    if (result) {
      setOpen(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setName(product.name);
      setPercentage(product.percentage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Settings2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nombre del Producto</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Vitamina D"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-percentage">Porcentaje de Comisión (%)</Label>
            <Input
              id="edit-percentage"
              type="number"
              min={0}
              max={100}
              value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
