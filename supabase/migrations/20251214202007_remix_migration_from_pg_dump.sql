CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



SET default_table_access_method = heap;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    notes text
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    concept text NOT NULL,
    amount numeric NOT NULL,
    category text,
    seller_id text
);


--
-- Name: invoice_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    product_name text NOT NULL,
    amount numeric(12,2) NOT NULL,
    percentage numeric(5,2) NOT NULL,
    commission numeric(12,2) NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ncf text NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    rest_amount numeric(12,2) NOT NULL,
    rest_percentage numeric(5,2) DEFAULT 25 NOT NULL,
    rest_commission numeric(12,2) NOT NULL,
    total_commission numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    client_id uuid
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    percentage numeric(5,2) DEFAULT 15 NOT NULL,
    color text DEFAULT '#6366f1'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: invoice_products invoice_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_products
    ADD CONSTRAINT invoice_products_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: invoice_products invoice_products_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_products
    ADD CONSTRAINT invoice_products_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: invoice_products Allow public delete invoice_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete invoice_products" ON public.invoice_products FOR DELETE USING (true);


--
-- Name: invoices Allow public delete invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete invoices" ON public.invoices FOR DELETE USING (true);


--
-- Name: products Allow public delete products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete products" ON public.products FOR DELETE USING (true);


--
-- Name: invoice_products Allow public insert invoice_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert invoice_products" ON public.invoice_products FOR INSERT WITH CHECK (true);


--
-- Name: invoices Allow public insert invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert invoices" ON public.invoices FOR INSERT WITH CHECK (true);


--
-- Name: products Allow public insert products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert products" ON public.products FOR INSERT WITH CHECK (true);


--
-- Name: settings Allow public insert settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert settings" ON public.settings FOR INSERT WITH CHECK (true);


--
-- Name: invoice_products Allow public read invoice_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read invoice_products" ON public.invoice_products FOR SELECT USING (true);


--
-- Name: invoices Allow public read invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read invoices" ON public.invoices FOR SELECT USING (true);


--
-- Name: products Allow public read products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read products" ON public.products FOR SELECT USING (true);


--
-- Name: settings Allow public read settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);


--
-- Name: invoice_products Allow public update invoice_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update invoice_products" ON public.invoice_products FOR UPDATE USING (true);


--
-- Name: invoices Allow public update invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update invoices" ON public.invoices FOR UPDATE USING (true);


--
-- Name: products Allow public update products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update products" ON public.products FOR UPDATE USING (true);


--
-- Name: settings Allow public update settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update settings" ON public.settings FOR UPDATE USING (true);


--
-- Name: clients Enable delete access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete access for all users" ON public.clients FOR DELETE USING (true);


--
-- Name: expenses Enable delete access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete access for all users" ON public.expenses FOR DELETE USING (true);


--
-- Name: clients Enable insert access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert access for all users" ON public.clients FOR INSERT WITH CHECK (true);


--
-- Name: expenses Enable insert access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert access for all users" ON public.expenses FOR INSERT WITH CHECK (true);


--
-- Name: clients Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.clients FOR SELECT USING (true);


--
-- Name: expenses Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.expenses FOR SELECT USING (true);


--
-- Name: clients Enable update access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update access for all users" ON public.clients FOR UPDATE USING (true);


--
-- Name: expenses Enable update access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update access for all users" ON public.expenses FOR UPDATE USING (true);


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_products ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


