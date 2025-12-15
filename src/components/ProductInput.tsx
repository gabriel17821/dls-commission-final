import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ProductInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  percentage: number;
  color: string;
  onDelete?: () => void;
  canDelete?: boolean;
}

export const ProductInput = ({ 
  label, 
  value, 
  onChange, 
  percentage, 
  color, 
  onDelete,
  canDelete = false 
}: ProductInputProps) => {
  const commission = value * (percentage / 100);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-4 transition-all hover:card-shadow animate-slide-up">
      <div 
        className="absolute left-0 top-0 h-full w-1 transition-all group-hover:w-1.5"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-foreground">{label}</Label>
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {percentage}% comisión
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              value={value || ""}
              onChange={(e) => onChange(Number(e.target.value) || 0)}
              className="w-32 pl-7 text-right font-medium"
              placeholder="0"
            />
          </div>
          {value > 0 && (
            <span className="text-sm font-semibold animate-number" style={{ color }}>
              +${formatCurrency(commission)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
