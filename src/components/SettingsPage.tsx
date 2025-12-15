import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Settings, Upload, Download, Trash2, FileUp, AlertTriangle, Check, Loader2, Users, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/hooks/useClients';

interface SettingsPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onRefetchClients: () => void;
}

export const SettingsPage = ({ open, onOpenChange, clients, onRefetchClients }: SettingsPageProps) => {
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes('nombre') ? 1 : 0;
      
      const newClients: { name: string; phone?: string; email?: string }[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values[0]) {
          newClients.push({
            name: values[0],
            phone: values[1] || undefined,
            email: values[2] || undefined,
          });
        }
      }

      if (newClients.length === 0) {
        toast.error('No se encontraron clientes válidos en el archivo');
        return;
      }

      const { error } = await supabase.from('clients').insert(newClients);

      if (error) throw error;

      toast.success(`${newClients.length} clientes importados correctamente`);
      onRefetchClients();
    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast.error('Error al importar el archivo CSV');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const [invoicesRes, invoiceProductsRes, clientsRes, productsRes, sellersRes, settingsRes] = await Promise.all([
        supabase.from('invoices').select('*'),
        supabase.from('invoice_products').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('products').select('*'),
        supabase.from('sellers').select('*'),
        supabase.from('settings').select('*'),
      ]);

      const backup = {
        version: '1.2', // Updated version
        exportDate: new Date().toISOString(),
        data: {
          invoices: invoicesRes.data || [],
          invoice_products: invoiceProductsRes.data || [],
          clients: clientsRes.data || [],
          products: productsRes.data || [],
          sellers: sellersRes.data || [],
          settings: settingsRes.data || [],
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_comisiones_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Backup exportado correctamente');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Error al exportar los datos');
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      let backup;
      try {
        backup = JSON.parse(text);
      } catch (e) {
        throw new Error('El archivo no es un JSON válido');
      }

      if (!backup.data) {
        throw new Error('Formato de backup inválido: falta la propiedad data');
      }

      // 1. Limpiar datos existentes (Orden importante para respetar Foreign Keys)
      await supabase.from('invoice_products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 2. Importar Vendedores (Sellers) primero
      if (backup.data.sellers?.length) {
        const cleanSellers = backup.data.sellers.map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email || null,
          phone: s.phone || null,
          is_default: s.is_default || false,
          created_at: s.created_at
        }));
        await supabase.from('sellers').upsert(cleanSellers, { onConflict: 'id' });
      }

      // IMPORTANTE: Obtener lista real de vendedores válidos de la base de datos
      // Esto previene el error de "foreign key constraint"
      const { data: validSellers } = await supabase.from('sellers').select('id');
      const validSellerIds = new Set(validSellers?.map(s => s.id) || []);

      // 3. Importar Clientes (Clients)
      let validClientIds = new Set<string>();
      if (backup.data.clients?.length) {
        const validClients = backup.data.clients.filter((c: any) => c.name && c.name.trim() !== '');
        
        const cleanClients = validClients.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone || null,
          email: c.email || null,
          address: c.address || null,
          notes: c.notes || null,
          created_at: c.created_at
        }));

        if (cleanClients.length > 0) {
          const { error } = await supabase.from('clients').upsert(cleanClients, { onConflict: 'id' });
          if (error) {
            console.error("Error importando clientes:", error);
            toast.warning("Hubo un problema con algunos clientes.");
          }
          // Obtener los IDs que realmente existen ahora en la BD
          const { data: currentClients } = await supabase.from('clients').select('id');
          currentClients?.forEach(c => validClientIds.add(c.id));
        }
      }

      // 4. Importar Productos del Catálogo
      if (backup.data.products?.length) {
        const cleanProducts = backup.data.products.map((p: any) => ({
          id: p.id,
          name: p.name,
          percentage: p.percentage,
          color: p.color || '#6366f1',
          is_default: p.is_default || false,
          created_at: p.created_at
        }));
        await supabase.from('products').upsert(cleanProducts, { onConflict: 'id' });
      }

      // 5. Importar Configuración
      if (backup.data.settings?.length) {
        await supabase.from('settings').upsert(backup.data.settings, { onConflict: 'id' });
      }

      // 6. Importar Facturas (Invoices)
      if (backup.data.invoices?.length) {
        const cleanInvoices = backup.data.invoices.map((inv: any) => {
          // Verificar cliente válido
          let clientId = inv.client_id;
          if (clientId && !validClientIds.has(clientId)) {
            clientId = null; 
          }

          // Verificar vendedor válido (SOLUCIÓN DEL ERROR)
          let sellerId = inv.seller_id;
          if (sellerId && !validSellerIds.has(sellerId)) {
            sellerId = null; // Si el vendedor no existe, dejarlo nulo para evitar crash
          }

          return {
            id: inv.id,
            ncf: inv.ncf,
            invoice_date: inv.invoice_date || inv.created_at,
            total_amount: inv.total_amount,
            rest_amount: inv.rest_amount,
            rest_percentage: inv.rest_percentage,
            rest_commission: inv.rest_commission,
            total_commission: inv.total_commission,
            created_at: inv.created_at,
            client_id: clientId,
            seller_id: sellerId // ID validado o null
          };
        });

        const { error: invError } = await supabase.from('invoices').insert(cleanInvoices);
        if (invError) throw invError;
      }

      // 7. Importar Productos de Facturas
      if (backup.data.invoice_products?.length) {
        const cleanInvProducts = backup.data.invoice_products.map((ip: any) => ({
          id: ip.id,
          invoice_id: ip.invoice_id,
          product_name: ip.product_name,
          amount: ip.amount,
          percentage: ip.percentage,
          commission: ip.commission
        }));
        const { error: ipError } = await supabase.from('invoice_products').insert(cleanInvProducts);
        if (ipError) throw ipError;
      }

      toast.success('Datos restaurados correctamente. Recargando...');
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (error: any) {
      console.error('Error importing data:', error);
      toast.error(`Error al importar: ${error.message || 'Formato inválido'}`);
    } finally {
      setImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAllData = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setDeleting(true);
    try {
      await supabase.from('invoice_products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      toast.success('Todos los datos han sido eliminados. Recargando...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error deleting data:', error);
      toast.error('Error al eliminar los datos');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="h-5 w-5" />
            Ajustes
          </DialogTitle>
          <DialogDescription>
            Configuración general y gestión de datos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Importar Clientes (CSV)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV con columnas: Nombre, Teléfono, Email
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {uploading ? 'Importando...' : 'Seleccionar archivo CSV'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Clientes actuales: <strong>{clients.length}</strong>
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Copia de Seguridad (Backup)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Guarda una copia de todo tu sistema o restaura una anterior.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleExportData}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar
              </Button>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => importFileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Restaurar
              </Button>
            </div>
          </Card>

          <Card className="p-4 space-y-3 border-destructive/50 bg-destructive/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold text-destructive">Zona de Peligro</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Elimina permanentemente facturas y clientes. Esta acción no se puede deshacer.
            </p>
            <Button
              variant={deleteConfirm ? "destructive" : "outline"}
              className="w-full gap-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDeleteAllData}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : deleteConfirm ? (
                <Check className="h-4 w-4" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {deleting ? 'Eliminando...' : deleteConfirm ? '¿Estás seguro? Click para confirmar' : 'Eliminar todos los datos'}
            </Button>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};