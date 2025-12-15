import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSettings = () => {
  const [restPercentage, setRestPercentage] = useState(25);
  const [lastNcfNumber, setLastNcfNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .in('key', ['rest_percentage', 'last_ncf_number']);
    
    if (error) {
      console.error(error);
    } else if (data) {
      data.forEach(setting => {
        if (setting.key === 'rest_percentage') {
          setRestPercentage(Number(setting.value));
        } else if (setting.key === 'last_ncf_number') {
          setLastNcfNumber(Number(setting.value));
        }
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateRestPercentage = async (value: number) => {
    const { error } = await supabase
      .from('settings')
      .update({ value: String(value), updated_at: new Date().toISOString() })
      .eq('key', 'rest_percentage');
    
    if (error) {
      toast.error('Error al actualizar porcentaje');
      console.error(error);
      return false;
    }
    
    setRestPercentage(value);
    toast.success('Porcentaje actualizado');
    return true;
  };

  const updateLastNcfNumber = async (value: number) => {
    // Check if the setting exists
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('key', 'last_ncf_number')
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('settings')
        .update({ value: String(value), updated_at: new Date().toISOString() })
        .eq('key', 'last_ncf_number');
      
      if (error) {
        console.error(error);
        return false;
      }
    } else {
      const { error } = await supabase
        .from('settings')
        .insert({ key: 'last_ncf_number', value: String(value) });
      
      if (error) {
        console.error(error);
        return false;
      }
    }
    
    setLastNcfNumber(value);
    return true;
  };

  const getNextNcfNumber = () => {
    if (lastNcfNumber === null) return null;
    return lastNcfNumber + 1;
  };

  return { 
    restPercentage, 
    lastNcfNumber,
    loading, 
    updateRestPercentage,
    updateLastNcfNumber,
    getNextNcfNumber
  };
};
