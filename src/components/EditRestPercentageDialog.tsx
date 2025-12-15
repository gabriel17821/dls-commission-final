import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';

interface EditRestPercentageDialogProps {
  currentValue: number;
  onUpdate: (value: number) => Promise<boolean>;
}

export const EditRestPercentageDialog = ({ currentValue, onUpdate }: EditRestPercentageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [percentage, setPercentage] = useState(currentValue);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await onUpdate(percentage);
    setLoading(false);
    if (success) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Porcentaje del Resto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rest-percentage">Porcentaje de Comisión para el Resto (%)</Label>
            <Input
              id="rest-percentage"
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
