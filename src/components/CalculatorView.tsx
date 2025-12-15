// ... (omitting CalculatorView top imports and props)

// ... (omitting component state and logic)

  // --- Toast de Última Factura (NUEVO DISEÑO) ---
  useEffect(() => {
    if (lastInvoice && !toastShownRef.current && lastInvoice.ncf) {
      try {
        // ... (omitting date calculations)

        toast.custom((t) => (
          // [MODIFICADO] Asegura que el ancho máximo sea max-w-xl
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

// ... (omitting remaining CalculatorView render)
