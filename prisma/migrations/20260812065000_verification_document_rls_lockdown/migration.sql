ALTER TABLE public."VerificationDocument" ENABLE ROW LEVEL SECURITY;
-- no policies (deny-all for non-bypass roles)

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;
