import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

interface AddProductDialogProps {
  onAdd: (name: string, percentage: number) => Promise<any>;
}

export const AddProductDialog = ({ onAdd }: AddProductDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState(15);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    const result = await onAdd(name.trim(), percentage);
    setLoading(false);
    
    if (result) {
      setName('');
      setPercentage(15);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Producto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar Producto Especial</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Producto</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Vitamina D"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="percentage">Porcentaje de Comisión (%)</Label>
            <Input
              id="percentage"
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
              {loading ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
