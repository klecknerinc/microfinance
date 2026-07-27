CREATE TABLE public.amex_bank_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  source_mask TEXT NOT NULL CHECK (source_mask ~ '^[0-9]{4}$'),
  destination_label TEXT NOT NULL
    CHECK (char_length(destination_label) BETWEEN 2 AND 100),
  destination_mask TEXT NOT NULL CHECK (destination_mask ~ '^[0-9]{4}$'),
  source_ownership TEXT NOT NULL
    CHECK (source_ownership IN ('consumer', 'business')),
  legal_name TEXT NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 200),
  accepted_by_amex BOOLEAN NOT NULL CHECK (accepted_by_amex = TRUE),
  confirmed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX amex_bank_setups_owner_id_idx
  ON public.amex_bank_setups (owner_id);

CREATE TABLE public.amex_transfer_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_id UUID NOT NULL REFERENCES public.amex_bank_setups(id) ON DELETE RESTRICT,
  source_mask TEXT NOT NULL CHECK (source_mask ~ '^[0-9]{4}$'),
  destination_label TEXT NOT NULL,
  destination_mask TEXT NOT NULL CHECK (destination_mask ~ '^[0-9]{4}$'),
  source_ownership TEXT NOT NULL
    CHECK (source_ownership IN ('consumer', 'business')),
  legal_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0 AND amount <= 999999.99),
  memo TEXT CHECK (memo IS NULL OR char_length(memo) <= 140),
  cadence TEXT NOT NULL
    CHECK (cadence IN ('one_time', 'weekly', 'biweekly', 'monthly')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('recorded_in_amex', 'cancelled')),
  amex_confirmation_reference TEXT
    CHECK (
      amex_confirmation_reference IS NULL OR
      char_length(amex_confirmation_reference) <= 100
    ),
  confirmation_text TEXT NOT NULL,
  confirmation_version TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL,
  confirmation_ip TEXT,
  confirmation_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX amex_transfer_plans_owner_created_idx
  ON public.amex_transfer_plans (owner_id, created_at DESC);

CREATE INDEX amex_transfer_plans_setup_id_idx
  ON public.amex_transfer_plans (setup_id);

CREATE TRIGGER amex_bank_setups_updated_at
BEFORE UPDATE ON public.amex_bank_setups
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.amex_bank_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amex_transfer_plans ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.amex_bank_setups FROM anon, authenticated;
REVOKE ALL ON public.amex_transfer_plans FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;

COMMENT ON TABLE public.amex_bank_setups IS
  'User-confirmed AMEX external-account setup. Stores labels and last four digits only.';

COMMENT ON TABLE public.amex_transfer_plans IS
  'Append-only records of live transfers created by the user inside American Express. This table does not execute money movement.';
