import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://maviagpzwdjywatckgii.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmlhZ3B6d2RqeXdhdGNrZ2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Nzk0OTEsImV4cCI6MjA4OTA1NTQ5MX0.fxyQRkHLg3TKcIT5BZPCI-xNnjwNyVX0Ta_HN2XfZRs';

export const supabase = createClient(supabaseUrl, supabaseKey);
