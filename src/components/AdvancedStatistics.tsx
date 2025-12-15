import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
  TrendingUp, DollarSign, Receipt, ChevronLeft, ChevronRight, 
  FileText, ArrowUpRight, ArrowDownRight, BarChart3, Activity,
  PieChart, CalendarDays, Maximize2, Trophy, Lightbulb, User, TrendingDown, Crown, Download, Briefcase, Star
} from 'lucide-react';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths, startOfYear, endOfYear, getYear, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { generateMonthlyPDF, generateAnnualPDF } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface StatisticsProps {
  invoices: Invoice[];
  clients?: Client[];
  sellerName?: string;
  onPreviewInvoice?: (invoice: Invoice) => void;
}

// FIX: Función de fecha a prueba de fallos
const parseInvoiceDate = (dateString: string | null | undefined): Date => {
  if (!dateString) return new Date();
  try {
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  } catch (e) {
    return new Date();
  }
};

export const Statistics = ({ invoices, clients = [], sellerName, onPreviewInvoice }: StatisticsProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');

  // Estados para diálogos
  const [selectedDayInvoices, setSelectedDayInvoices] = useState<Invoice[]>([]);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);

  const [selectedMonthDetail, setSelectedMonthDetail] = useState<any>(null);
  const [isMonthDialogOpen, setIsMonthDialogOpen] = useState(false);

  const [isRangeExportOpen, setIsRangeExportOpen] = useState(false);
  const [rangeStartMonth, setRangeStartMonth] = useState<string>('0');
  const [rangeEndMonth, setRangeEndMonth] = useState<string>('11');

  const [recordInvoice, setRecordInvoice] = useState<Invoice | null>(null);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);

  const safeInvoices = invoices || [];

  const firstName = useMemo(() => {
    return sellerName ? sellerName.split(' ')[0] : 'Neftalí';
  }, [sellerName]);

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Cliente Desconocido';
    return clients.find(c => c.id === clientId)?.name || 'Cliente Desconocido';
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    for (let i = -1; i <= 5; i++) years.add(currentYear - i);
    safeInvoices.forEach(inv => {
      const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
      years.add(getYear(date));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [safeInvoices]);

  const selectedMonthStats = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const monthInvoices = safeInvoices.filter(inv => {
      const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
      return isWithinInterval(date, { start, end });
    });

    const daysInMonth = end.getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayNum);
        return { 
            day: dayNum, date, sales: 0, commission: 0, count: 0,
            label: format(date, 'd', { locale: es }),
            tooltipLabel: format(date, "EEEE d 'de' MMMM", { locale: es })
        };
    });

    // Análisis de Clientes del Mes
    const clientPerformance: Record<string, { id: string, name: string, amount: number, count: number }> = {};

    monthInvoices.forEach(inv => {
        const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
        const dayIndex = date.getDate() - 1;
        
        // Daily Data
        if (dailyData[dayIndex]) {
            dailyData[dayIndex].sales += Number(inv.total_amount || 0);
            dailyData[dayIndex].commission += Number(inv.total_commission || 0);
            dailyData[dayIndex].count += 1;
        }

        // Client Data
        if (inv.client_id) {
            if (!clientPerformance[inv.client_id]) {
                clientPerformance[inv.client_id] = {
                    id: inv.client_id,
                    name: getClientName(inv.client_id),
                    amount: 0,
                    count: 0
                };
            }
            clientPerformance[inv.client_id].amount += Number(inv.total_amount || 0);
            clientPerformance[inv.client_id].count += 1;
        }
    });

    const topClient = Object.values(clientPerformance).sort((a, b) => b.amount - a.amount)[0] || null;
    const maxCommissionDay = Math.max(...dailyData.map(d => d.commission), 1);
    const bestDay = dailyData.reduce((prev, current) => (prev.commission > current.commission) ? prev : current, dailyData[0]);

    return {
      totalSales: monthInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
      totalCommission: monthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission || 0), 0),
      invoiceCount: monthInvoices.length,
      invoices: monthInvoices,
      avgPerInvoice: monthInvoices.length > 0 ? monthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission || 0), 0) / monthInvoices.length : 0,
      dailyData, maxCommissionDay, bestDay, topClient
    };
  }, [safeInvoices, selectedDate, clients]);

  const yearStats = useMemo(() => {
    const start = startOfYear(new Date(selectedYear, 0, 1));
    const end = endOfYear(new Date(selectedYear, 0, 1));
    const yearInvoices = safeInvoices.filter(inv => {
      const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
      return isWithinInterval(date, { start, end });
    });

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(selectedYear, i, 15);
        return {
            month: i,
            label: format(date, 'MMMM', { locale: es }),
            shortLabel: format(date, 'MMM', { locale: es }),
            commission: 0, sales: 0, count: 0, growth: 0,
            products: new Map<string, { sales: number, commission: number }>() 
        };
    });

    yearInvoices.forEach(inv => {
        const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
        const monthIndex = date.getMonth();
        if (monthlyData[monthIndex]) {
            const m = monthlyData[monthIndex];
            m.commission += Number(inv.total_commission || 0);
            m.sales += Number(inv.total_amount || 0);
            m.count += 1;
            inv.products?.forEach(p => {
                const existing = m.products.get(p.product_name) || { sales: 0, commission: 0 };
                m.products.set(p.product_name, { sales: existing.sales + Number(p.amount || 0), commission: existing.commission + Number(p.commission || 0) });
            });
            if (inv.rest_amount > 0) {
                const existing = m.products.get('Resto de Productos') || { sales: 0, commission: 0 };
                m.products.set('Resto de Productos', { sales: existing.sales + Number(inv.rest_amount || 0), commission: existing.commission + Number(inv.rest_commission || 0) });
            }
        }
    });

    const enrichedMonthlyData = monthlyData.map((m, i) => {
        const previous = i > 0 ? monthlyData[i - 1].commission : 0;
        const growth = previous > 0 ? ((m.commission - previous) / previous) * 100 : 0;
        const productRanking = Array.from(m.products.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.commission - a.commission);
        return { ...m, growth, productRanking };
    });

    const maxCommissionMonth = Math.max(...enrichedMonthlyData.map(m => m.commission), 1);

    return {
      totalSales: yearInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
      totalCommission: yearInvoices.reduce((sum, inv) => sum + Number(inv.total_commission || 0), 0),
      invoiceCount: yearInvoices.length,
      monthlyData: enrichedMonthlyData,
      maxCommissionMonth
    };
  }, [safeInvoices, selectedYear]);

  const previousMonthStats = useMemo(() => {
    const prevDate = subMonths(selectedDate, 1);
    const start = startOfMonth(prevDate);
    const end = endOfMonth(prevDate);
    const monthInvoices = safeInvoices.filter(inv => {
        const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
        return isWithinInterval(date, { start, end });
    });
    return {
      totalCommission: monthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission || 0), 0),
      totalSales: monthInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
      invoiceCount: monthInvoices.length
    };
  }, [safeInvoices, selectedDate]);

  const smartAnalysis = useMemo(() => {
    const currentBreakdown: Record<string, { commission: number, sales: number }> = {};
    let restCommission = 0; let restSales = 0;
    let maxInvoiceObj: Invoice | null = null;
    let maxAmount = 0;

    selectedMonthStats.invoices.forEach(inv => {
      restCommission += Number(inv.rest_commission || 0);
      restSales += Number(inv.rest_amount || 0);
      
      if (Number(inv.total_amount || 0) > maxAmount) {
        maxAmount = Number(inv.total_amount || 0);
        maxInvoiceObj = inv;
      }

      inv.products?.forEach(prod => {
        if (!currentBreakdown[prod.product_name]) currentBreakdown[prod.product_name] = { commission: 0, sales: 0 };
        currentBreakdown[prod.product_name].commission += Number(prod.commission || 0);
        currentBreakdown[prod.product_name].sales += Number(prod.amount || 0);
      });
    });

    const ranking = [
      { name: 'Resto de productos', type: 'rest', commission: restCommission, sales: restSales },
      ...Object.entries(currentBreakdown).map(([name, data]) => ({
        name, type: 'product', commission: data.commission, sales: data.sales
      }))
    ].sort((a, b) => b.commission - a.commission);

    const winner = ranking[0];
    const secondPlace = ranking[1];
    
    let narrative = "";
    const monthName = format(selectedDate, 'MMMM', { locale: es });
    
    if (selectedMonthStats.invoiceCount === 0) {
      narrative = "No hay suficiente actividad registrada este mes para generar un análisis estratégico.";
    } else {
      narrative = `En el mes de ${monthName}, se logró un total de ventas para DLS de $${formatNumber(selectedMonthStats.totalSales)}. El mayor rendimiento provino de `;
      if (winner) {
        narrative += `"${winner.name}", que generó $${formatNumber(winner.commission)} en comisiones. `;
        if (winner.type === 'rest') narrative += `Es notable que la categoría "Resto de productos" lidera, debido a que acumula el 25% de los productos de las facturas. `;
      }
      if (selectedMonthStats.topClient) {
        narrative += `El cliente más activo fue ${selectedMonthStats.topClient.name}, aportando $${formatNumber(selectedMonthStats.topClient.amount)} al volumen de ventas. `;
      }
      narrative += `En promedio, cada factura generó una ganancia de $${formatNumber(Math.round(selectedMonthStats.avgPerInvoice))} para ${firstName}.`;
    }

    return { ranking, totalComm: selectedMonthStats.totalCommission, winner, secondPlace, narrative, maxInvoiceObj };
  }, [selectedMonthStats, selectedDate, firstName]);

  const commChange = {
    percent: previousMonthStats.totalCommission === 0 ? 0 : Math.abs(((selectedMonthStats.totalCommission - previousMonthStats.totalCommission) / previousMonthStats.totalCommission) * 100).toFixed(1),
    isPositive: selectedMonthStats.totalCommission >= previousMonthStats.totalCommission
  };
  const salesChange = {
    percent: previousMonthStats.totalSales === 0 ? 0 : Math.abs(((selectedMonthStats.totalSales - previousMonthStats.totalSales) / previousMonthStats.totalSales) * 100).toFixed(1),
    isPositive: selectedMonthStats.totalSales >= previousMonthStats.totalSales
  };
  const invoiceChange = {
    percent: previousMonthStats.invoiceCount === 0 ? 0 : Math.abs(((selectedMonthStats.invoiceCount - previousMonthStats.invoiceCount) / previousMonthStats.invoiceCount) * 100).toFixed(1),
    isPositive: selectedMonthStats.invoiceCount >= previousMonthStats.invoiceCount
  };

  const handleDayClick = (dayData: any) => {
    if (dayData.count === 0) return;
    const invoicesForDay = safeInvoices.filter(inv => isSameDay(parseInvoiceDate(inv.invoice_date || inv.created_at), dayData.date));
    setSelectedDayInvoices(invoicesForDay);
    setSelectedDayDate(dayData.date);
    setIsDayDialogOpen(true);
  };

  const handleMonthClick = (monthData: any) => {
    if (monthData.count === 0) return;
    setSelectedMonthDetail(monthData);
    setIsMonthDialogOpen(true);
  };

  const handleRecordClick = () => {
    if (smartAnalysis.maxInvoiceObj) {
      setRecordInvoice(smartAnalysis.maxInvoiceObj);
      setIsRecordDialogOpen(true);
    }
  };

  const handleRangeExport = () => {
    const start = parseInt(rangeStartMonth);
    const end = parseInt(rangeEndMonth);
    if (start > end) { toast.error('El mes de inicio no puede ser mayor al final.'); return; }
    const startDate = new Date(selectedYear, start, 1);
    const endDate = endOfMonth(new Date(selectedYear, end, 1));
    const filteredInvoices = safeInvoices.filter(inv => {
      const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
    const label = `${format(startDate, 'MMMM', { locale: es })} - ${format(endDate, 'MMMM yyyy', { locale: es })}`;
    generateAnnualPDF(selectedYear, filteredInvoices, sellerName || 'Neftalí Jiménez', label);
    toast.success('Reporte generado correctamente');
    setIsRangeExportOpen(false);
  };

  const renderProductList = (invoice: Invoice) => {
    const items = [];
    if (invoice.products && invoice.products.length > 0) invoice.products.forEach(p => items.push(`${p.product_name} ($${formatNumber(p.amount || 0)})`));
    if (invoice.rest_amount > 0) items.push(`Resto ($${formatNumber(invoice.rest_amount || 0)})`);
    return items.length ? items.join(', ') : "Sin desglose";
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i.toString(), label: format(new Date(2024, i, 15), 'MMMM', { locale: es }) }));

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6 animate-fade-in font-sans text-slate-800 dark:text-slate-100 pb-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-xl bg-white dark:bg-card border border-border shadow-sm">
            <div className="flex items-center gap-2">
                <div className="flex bg-muted/50 p-1 rounded-lg">
                    <Button variant={viewMode === 'month' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('month')} className="h-8 text-sm font-medium">Mensual</Button>
                    <Button variant={viewMode === 'year' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('year')} className="h-8 text-sm font-medium">Anual</Button>
                </div>
                {viewMode === 'month' && selectedMonthStats.invoiceCount > 0 && (
                    <Button variant="outline" size="sm" className="h-8 gap-2 ml-2 text-xs border-primary/20 hover:bg-primary/5 hover:text-primary" onClick={() => {
                        generateMonthlyPDF(selectedMonthStats.invoices, format(selectedDate, "MMMM yyyy", { locale: es }));
                        toast.success('Generando PDF...');
                    }}><FileText className="h-3.5 w-3.5" /> PDF</Button>
                )}
                {viewMode === 'year' && yearStats.totalSales > 0 && (
                    <Button variant="outline" size="sm" className="h-8 gap-2 ml-2 text-xs border-primary/20 hover:bg-primary/5 hover:text-primary" onClick={() => setIsRangeExportOpen(true)}>
                        <Download className="h-3.5 w-3.5" /> Exportar Período
                    </Button>
                )}
            </div>
            <div className="flex items-center gap-2">
                {viewMode === 'month' && (
                    <div className="flex items-center bg-background border rounded-md shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => subMonths(prev, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="w-32 text-center text-sm font-semibold capitalize">{format(selectedDate, 'MMMM yyyy', { locale: es })}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addMonths(prev, 1))}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                )}
                <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); setSelectedDate(new Date(Number(v), selectedDate.getMonth(), 1)); }}>
                    <SelectTrigger className="w-[85px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{availableYears.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </div>

        {viewMode === 'month' ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className={`col-span-1 md:col-span-2 text-white border-none shadow-lg relative overflow-hidden bg-gradient-to-br ${commChange.isPositive ? 'from-emerald-600 to-emerald-500' : 'from-rose-600 to-rose-500'}`}>
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4">{commChange.isPositive ? <TrendingUp className="h-32 w-32" /> : <TrendingDown className="h-32 w-32" />}</div>
                    <CardHeader className="pb-2"><CardTitle className="text-base font-bold text-white/90 uppercase tracking-wide flex items-center gap-2"><Briefcase className="h-5 w-5" /> Comisiones de {sellerName || 'Usuario'}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-4xl md:text-5xl font-bold tracking-tight mb-2">${formatCurrency(selectedMonthStats.totalCommission || 0)}</div>
                        <div className="flex items-center gap-3 text-sm font-medium text-white/90">
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-sm">{commChange.isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{commChange.percent}%</span>
                            <span className="opacity-80">vs mes anterior</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 shadow-sm border-t-4 border-t-blue-500">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-500" /> Ventas Totales</CardTitle></CardHeader>
                    <CardContent className="space-y-2"><div className="text-2xl font-bold text-foreground">${formatNumber(selectedMonthStats.totalSales || 0)}</div><div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-semibold ${salesChange.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{salesChange.isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{salesChange.percent}%</div></CardContent>
                </Card>

                <Card className="col-span-1 shadow-sm border-t-4 border-t-orange-500">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2"><Receipt className="h-4 w-4 text-orange-500" /> Facturas</CardTitle></CardHeader>
                    <CardContent className="space-y-2"><div className="text-2xl font-bold text-foreground">{selectedMonthStats.invoiceCount}</div><div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-semibold ${invoiceChange.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{invoiceChange.isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{invoiceChange.percent}%</div></CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-base font-bold flex items-center gap-2 text-blue-900 dark:text-blue-100"><Lightbulb className="h-5 w-5 text-blue-500" /> Resumen Ejecutivo</CardTitle></CardHeader>
                    <CardContent><p className="text-sm font-medium text-blue-800 dark:text-blue-200 leading-relaxed text-justify">{smartAnalysis.narrative}</p></CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2 border border-border/50">
                    <CardHeader className="pb-2"><CardTitle className="text-base font-bold flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Resumen Estratégico</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4 pt-2">
                        {/* Top Product */}
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-lg border border-border shadow-sm hover:border-amber-300 transition-colors">
                            <div><div className="text-xs text-muted-foreground uppercase font-bold mb-1 flex items-center gap-1"><Trophy className="h-4 w-4 text-amber-500" /> Ganador #1</div><div className="font-bold text-primary text-xl truncate max-w-[200px]">{smartAnalysis.winner?.name || "Sin datos"}</div><div className="text-xs text-muted-foreground mt-1">Venta DLS: <span className="font-semibold text-foreground">${formatNumber(smartAnalysis.winner?.sales || 0)}</span></div></div><div className="text-right"><div className="text-xs text-muted-foreground font-medium">Comisión {firstName}</div><div className="font-extrabold text-emerald-600 text-2xl">${formatNumber(smartAnalysis.winner?.commission || 0)}</div></div>
                        </div>
                        
                        {/* Top Client Card */}
                        {selectedMonthStats.topClient && (
                            <div className="flex items-center justify-between p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-inner">
                                <div>
                                    <div className="text-xs text-amber-700 dark:text-amber-400 uppercase font-bold mb-1 flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 text-amber-600 fill-amber-600" /> Cliente Líder
                                    </div>
                                    <div className="font-bold text-foreground text-lg truncate max-w-[200px]">{selectedMonthStats.topClient.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{selectedMonthStats.topClient.count} facturas</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground font-medium">Volumen Compra</div>
                                    <div className="font-bold text-amber-700 dark:text-amber-500 text-xl">${formatNumber(selectedMonthStats.topClient.amount)}</div>
                                </div>
                            </div>
                        )}

                        {/* Record Invoice */}
                        {smartAnalysis.maxInvoiceObj && (
                            <div className="flex items-center justify-between p-4 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50 shadow-inner cursor-pointer hover:bg-indigo-100/50 transition-colors group" onClick={handleRecordClick}>
                                <div><div className="text-xs text-indigo-700 dark:text-indigo-300 uppercase font-bold mb-1 flex items-center gap-1"><Crown className="h-3.5 w-3.5 text-indigo-600" /> Venta Récord</div><div className="font-bold text-foreground text-xl">${formatNumber(smartAnalysis.maxInvoiceObj.total_amount || 0)}</div><div className="text-sm font-mono text-indigo-600 dark:text-indigo-400 font-bold group-hover:underline mt-0.5">{smartAnalysis.maxInvoiceObj.ncf}</div></div><div className="text-right"><div className="text-xs text-muted-foreground font-medium">Comisión Generada</div><div className="font-bold text-indigo-700 dark:text-indigo-400 text-lg">${formatNumber(smartAnalysis.maxInvoiceObj.total_commission || 0)}</div></div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2 flex flex-col">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-base font-bold flex items-center gap-2"><PieChart className="h-5 w-5 text-muted-foreground" /> Origen de los ingresos</CardTitle></CardHeader>
                    <CardContent className="flex-1 space-y-4 pt-2">
                        {smartAnalysis.ranking.slice(0, 4).map((item, idx) => {
                             const percentage = ((item.commission / (smartAnalysis.totalComm || 1)) * 100).toFixed(1);
                             return (
                                <div key={idx} className="text-sm group">
                                    <div className="flex justify-between items-end mb-1">
                                        <div className="flex items-center gap-2 max-w-[60%]"><span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span><span className="font-semibold text-foreground text-base truncate" title={item.name}>{item.name}</span></div>
                                        <div className="text-right flex flex-col items-end"><span className="font-bold text-emerald-600 text-sm">${formatNumber(item.commission)}</span><span className="text-xs text-muted-foreground">{percentage}%</span></div>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${idx === 0 ? 'bg-primary' : 'bg-slate-400'}`} style={{ width: `${percentage}%` }} /></div>
                                </div>
                             );
                        })}
                    </CardContent>
                    <CardFooter className="pt-2 pb-4">
                        <Dialog>
                            <DialogTrigger asChild><Button variant="outline" className="w-full text-xs gap-2 border-dashed h-9"><Maximize2 className="h-3.5 w-3.5" /> Ver Desglose Completo</Button></DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                                <DialogHeader><DialogTitle>Desglose Total de Ingresos</DialogTitle><DialogDescription>Correlación detallada entre ventas y comisiones.</DialogDescription></DialogHeader>
                                {/* FIX: Scroll nativo para evitar crash en dialog */}
                                <div className="flex-1 overflow-y-auto pr-4 mt-4 max-h-[60vh]">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 sticky top-0"><tr className="text-left text-muted-foreground border-b"><th className="pb-3 pl-3 font-medium">Producto</th><th className="pb-3 text-right font-medium">Ventas DLS</th><th className="pb-3 text-right pr-3 font-medium">Comisión {firstName}</th><th className="pb-3 text-right pr-3 font-medium">% Total</th></tr></thead>
                                        <tbody className="divide-y">
                                            {smartAnalysis.ranking.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="py-3 pl-3 font-medium flex items-center gap-2"><Badge variant="outline" className="h-5 w-6 justify-center">{idx + 1}</Badge> {item.name}</td>
                                                    <td className="py-3 text-right text-muted-foreground">${formatNumber(item.sales)}</td>
                                                    <td className="py-3 text-right pr-3 font-bold text-emerald-600">${formatCurrency(item.commission)}</td>
                                                    <td className="py-3 text-right pr-3 text-muted-foreground">{((item.commission / (smartAnalysis.totalComm || 1)) * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardFooter>
                </Card>

                <Card className="col-span-1 md:col-span-4 shadow-sm border border-border/60">
                    <CardHeader className="pb-2 border-b border-border/40">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div><CardTitle className="text-lg font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Actividad Diaria</CardTitle><CardDescription>Clic en una barra para ver detalle.</CardDescription></div>
                            {selectedMonthStats.bestDay.commission > 0 && <div className="bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-2"><Trophy className="h-4 w-4 text-emerald-600" /><p className="text-sm text-emerald-900 dark:text-emerald-100 font-semibold">El mejor día de {firstName} fue el {format(selectedMonthStats.bestDay.date, "d 'de' MMMM", { locale: es })}.</p></div>}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 px-4">
                        <div className="w-full overflow-x-auto pb-4">
                            <div className="h-[220px] flex items-end gap-2 min-w-[700px] px-2">
                                {selectedMonthStats.dailyData.map((day, idx) => {
                                    const heightPercent = selectedMonthStats.maxCommissionDay > 0 ? (day.commission / selectedMonthStats.maxCommissionDay) * 100 : 0;
                                    const isBest = day.commission === selectedMonthStats.maxCommissionDay && day.commission > 0;
                                    return (
                                        <div key={idx} className="flex flex-col items-center group relative h-full justify-end flex-1 min-w-[20px]" onClick={() => handleDayClick(day)}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className={`w-full rounded-t-sm transition-all duration-300 cursor-pointer ${isBest ? 'bg-gradient-to-t from-emerald-500 to-emerald-400' : day.commission > 0 ? 'bg-primary/70 hover:bg-primary' : 'bg-muted h-[2px]'}`} style={{ height: day.commission > 0 ? `${Math.max(heightPercent, 5)}%` : '2px' }} />
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-slate-900 text-white border-slate-800 p-3 shadow-xl">
                                                    <div className="text-xs">
                                                        <p className="font-bold mb-2 border-b border-slate-700 pb-1">{day.tooltipLabel}</p>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                            <span className="text-slate-400">Ventas:</span><span className="font-mono text-right">${formatNumber(day.sales)}</span>
                                                            <span className="text-emerald-400 font-semibold">Comisión:</span><span className="font-mono text-right text-emerald-400">${formatNumber(day.commission)}</span>
                                                            <span className="text-slate-400">Facturas:</span><span className="text-right">{day.count}</span>
                                                        </div>
                                                        <p className="mt-2 text-[10px] text-center text-slate-500 italic">Clic para ver detalle</p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                            <div className="mt-2 text-[9px] font-medium text-muted-foreground">{day.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        ) : (
            <div className="space-y-6 animate-fade-in">
                <Card className="shadow-md">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Rendimiento Anual {selectedYear}</CardTitle><CardDescription>Comisiones de {sellerName || 'Usuario'}</CardDescription></CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-end justify-between gap-2 px-2">
                            {yearStats.monthlyData.map((month, idx) => {
                                const heightPercent = yearStats.maxCommissionMonth > 0 ? (month.commission / yearStats.maxCommissionMonth) * 100 : 0;
                                return (
                                    <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full relative" onClick={() => handleMonthClick(month)}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="w-full max-w-[50px] rounded-t bg-primary/20 hover:bg-primary transition-colors cursor-pointer" style={{ height: `${Math.max(heightPercent, 2)}%` }} />
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white border-slate-800 p-3 shadow-xl">
                                                <div className="text-xs">
                                                    <p className="font-bold mb-2 border-b border-slate-700 pb-1 capitalize">{month.label}</p>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                        <span className="text-slate-400">Ventas:</span><span className="font-mono text-right">${formatNumber(month.sales)}</span>
                                                        <span className="text-emerald-400 font-semibold">Comisión:</span><span className="font-mono text-right text-emerald-400">${formatNumber(month.commission)}</span>
                                                        <span className="text-slate-400">Facturas:</span><span className="text-right">{month.count}</span>
                                                    </div>
                                                    <p className="mt-2 text-[10px] text-center text-slate-500 italic">Clic para ver Top Productos</p>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                        <div className="mt-2 text-[10px] font-medium text-muted-foreground">{month.shortLabel}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border border-border/60">
                    <CardHeader className="py-4 border-b bg-muted/20"><CardTitle className="text-sm font-bold flex items-center gap-2"><Activity className="h-4 w-4" /> Movimiento Anual Mes por Mes</CardTitle></CardHeader>
                    {/* Scroll Nativo */}
                    <div className="h-[400px] w-full overflow-y-auto p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0"><tr className="text-left text-xs uppercase text-muted-foreground"><th className="px-6 py-3 font-medium">Mes</th><th className="px-6 py-3 font-medium text-right">Ventas para DLS</th><th className="px-6 py-3 font-medium text-right">Comisión {firstName}</th><th className="px-6 py-3 font-medium text-right">Crecimiento</th></tr></thead>
                            <tbody className="divide-y divide-border/40">
                                {yearStats.monthlyData.map((month, idx) => {
                                    if (month.sales === 0 && month.commission === 0) return null;
                                    const isPositive = month.growth >= 0;
                                    return (
                                        <tr key={idx} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handleMonthClick(month)}>
                                            <td className="px-6 py-3 font-medium capitalize">{month.label}</td>
                                            <td className="px-6 py-3 text-right text-muted-foreground">${formatNumber(month.sales)}</td>
                                            <td className="px-6 py-3 text-right font-bold text-emerald-600">${formatCurrency(month.commission)}</td>
                                            <td className="px-6 py-3 text-right"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${idx === 0 ? 'bg-gray-100 text-gray-500' : isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{idx === 0 ? '-' : <>{isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}{Math.abs(month.growth).toFixed(1)}%</>}</span></td>
                                        </tr>
                                    );
                                })}
                                {yearStats.totalSales === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No hay actividad registrada este año.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        )}

        {/* DIÁLOGOS (SCROLL NATIVO & BLINDADOS) */}
        <Dialog open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
            <DialogContent className="max-w-md flex flex-col p-0 overflow-hidden" style={{ maxHeight: '80vh' }}>
                <DialogHeader className="px-6 pt-6 pb-2"><DialogTitle>Detalle del {selectedDayDate && format(selectedDayDate, "d 'de' MMMM", { locale: es })}</DialogTitle><DialogDescription>{selectedDayInvoices.length} factura(s) registrada(s).</DialogDescription></DialogHeader>
                {/* FIX SCROLL: div nativo con overflow-y-auto */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <div className="space-y-3 pt-2">
                        {selectedDayInvoices.map((inv) => (
                            <div key={inv.id} className="p-4 border rounded-lg bg-card shadow-sm hover:border-primary/50 transition-colors">
                                <div className="flex justify-between items-start mb-3"><div className="flex flex-col"><span className="font-mono font-bold text-base text-foreground">{inv.ncf}</span>
                                {inv.client_id && <span className="text-xs text-primary font-medium flex items-center gap-1 mt-1"><User className="h-3 w-3"/> {getClientName(inv.client_id)}</span>}
                                </div><div className="text-right"><div className="text-xs text-muted-foreground mb-0.5">Comisión:</div><div className="font-bold text-emerald-600 text-lg">${formatCurrency(inv.total_commission || 0)}</div></div></div>
                                <div className="flex justify-between items-center text-sm border-t border-dashed pt-2 mt-2"><span className="text-muted-foreground">Venta Total:</span><span className="font-medium">${formatNumber(inv.total_amount || 0)}</span></div>
                                <div className="mt-3 text-xs bg-muted/50 p-2.5 rounded text-muted-foreground leading-relaxed"><span className="font-semibold text-foreground/80">Desglose: </span>{renderProductList(inv)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={isMonthDialogOpen} onOpenChange={setIsMonthDialogOpen}>
            <DialogContent className="max-w-md flex flex-col p-0 overflow-hidden" style={{ maxHeight: '80vh' }}>
                <DialogHeader className="px-6 pt-6 pb-2"><DialogTitle className="capitalize">Resumen de {selectedMonthDetail?.label}</DialogTitle><DialogDescription>Ventas: ${formatNumber(selectedMonthDetail?.sales || 0)} • Comisiones: ${formatNumber(selectedMonthDetail?.commission || 0)}</DialogDescription></DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Top Productos del Mes</h4>
                        {selectedMonthDetail?.productRanking?.slice(0, 3).map((p: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border border-border/50">
                                <div className="flex items-center gap-2"><Badge variant="secondary" className="h-5 w-5 justify-center p-0">{idx + 1}</Badge> <span className="font-medium text-sm">{p.name}</span></div>
                                <div className="text-right"><div className="font-bold text-emerald-600 text-sm">${formatCurrency(p.commission || 0)}</div><div className="text-[10px] text-muted-foreground">Venta: ${formatNumber(p.sales || 0)}</div></div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={isRangeExportOpen} onOpenChange={setIsRangeExportOpen}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader><DialogTitle>Exportar Reporte Personalizado</DialogTitle><DialogDescription>Selecciona el rango de meses.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Desde</Label><Select value={rangeStartMonth} onValueChange={setRangeStartMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Hasta</Label><Select value={rangeEndMonth} onValueChange={setRangeEndMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div></div></div>
                {/* REPLACED DIALOGFOOTER with DIV to prevent crashes */}
                <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setIsRangeExportOpen(false)}>Cancelar</Button><Button onClick={handleRangeExport} className="gap-2"><FileText className="h-4 w-4" /> Generar PDF</Button></div>
            </DialogContent>
        </Dialog>

        <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Detalle de Venta Récord</DialogTitle><DialogDescription>La factura con mayor valor del mes.</DialogDescription></DialogHeader>
                {recordInvoice && (
                    <div className="p-4 border rounded-lg bg-card shadow-sm mt-2">
                        <div className="flex justify-between items-start mb-3"><div className="flex flex-col"><span className="font-mono font-bold text-xl text-foreground">{recordInvoice.ncf}</span>
                        {recordInvoice.client_id && <span className="text-sm text-primary font-medium flex items-center gap-1 mt-1"><User className="h-3.5 w-3.5"/> {getClientName(recordInvoice.client_id)}</span>}
                        </div><div className="text-right"><div className="text-xs text-muted-foreground mb-0.5">Comisión Total</div><div className="font-bold text-emerald-600 text-2xl">${formatCurrency(recordInvoice.total_commission || 0)}</div></div></div>
                        <div className="flex justify-between items-center text-sm border-t border-dashed pt-4 mt-2"><span className="text-muted-foreground">Venta Total Facturada:</span><span className="font-bold text-lg">${formatNumber(recordInvoice.total_amount || 0)}</span></div>
                        <div className="mt-4 pt-4 border-t"><h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Desglose de Productos</h4><div className="space-y-2 text-sm">{renderProductList(recordInvoice)}</div></div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};