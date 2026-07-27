import {
  createAdminClient,
  createClient,
} from 'npm:@insforge/sdk';

type Cadence = 'one_time' | 'weekly' | 'biweekly' | 'monthly';
type AccountOwnership = 'consumer' | 'business';

const baseUrl = requiredEnv('INSFORGE_BASE_URL');
const adminApiKey = requiredEnv('API_KEY');
const appOrigin = requiredEnv('APP_ORIGIN').replace(/\/$/, '');

const admin = createAdminClient({
  baseUrl,
  apiKey: adminApiKey,
});

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function corsHeaders(origin: string | null) {
  const allowed = origin === appOrigin;
  return {
    'Access-Control-Allow-Origin': allowed ? origin : appOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function authenticatedUser(req: Request) {
  const header = req.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Unauthorized');

  const client = createClient({ baseUrl, accessToken: token });
  const { data, error } = await client.auth.getCurrentUser();
  if (error || !data?.user?.id) throw new Error('Unauthorized');
  return data.user;
}

function clientIp(req: Request) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    null
  );
}

function publicSetup(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    sourceMask: row.source_mask,
    destinationLabel: row.destination_label,
    destinationMask: row.destination_mask,
    sourceOwnership: row.source_ownership,
    legalName: row.legal_name,
    confirmedAt: row.confirmed_at,
    updatedAt: row.updated_at,
  };
}

async function activeSetup(ownerId: string) {
  const { data, error } = await admin.database
    .from('amex_bank_setups')
    .select(
      'id, owner_id, source_mask, destination_label, destination_mask, source_ownership, legal_name, accepted_by_amex, confirmed_at, updated_at',
    )
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function dashboard(ownerId: string) {
  const [setup, plansResult] = await Promise.all([
    activeSetup(ownerId),
    admin.database
      .from('amex_transfer_plans')
      .select(
        'id, amount, memo, cadence, scheduled_for, status, amex_confirmation_reference, created_at',
      )
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (plansResult.error) throw plansResult.error;

  return {
    mode: 'production',
    transferExecutor: 'american_express',
    bankSetup: publicSetup(setup),
    plans: (plansResult.data || []).map((row: any) => ({
      id: row.id,
      amount: row.amount,
      memo: row.memo,
      cadence: row.cadence,
      scheduledFor: row.scheduled_for,
      status: row.status,
      amexConfirmationReference: row.amex_confirmation_reference,
      createdAt: row.created_at,
    })),
  };
}

function validateSetup(raw: any) {
  const sourceMask = String(raw?.sourceMask || '').trim();
  const destinationLabel = String(raw?.destinationLabel || '').trim();
  const destinationMask = String(raw?.destinationMask || '').trim();
  const sourceOwnership = raw?.sourceOwnership as AccountOwnership;
  const legalName = String(raw?.legalName || '').trim();

  if (!/^\d{4}$/.test(sourceMask)) {
    throw new Error('AMEX Savings last four must contain exactly four digits.');
  }
  if (!/^\d{4}$/.test(destinationMask)) {
    throw new Error('Business account last four must contain exactly four digits.');
  }
  if (
    destinationLabel.length < 2 ||
    destinationLabel.length > 100
  ) {
    throw new Error('Business destination label is invalid.');
  }
  if (!['consumer', 'business'].includes(sourceOwnership)) {
    throw new Error('Source ownership must be confirmed.');
  }
  if (legalName.length < 2 || legalName.length > 200) {
    throw new Error('Exact legal account-owner name is required.');
  }
  if (raw?.acceptedByAmex !== true) {
    throw new Error(
      'Confirm that American Express accepted the external account.',
    );
  }

  return {
    sourceMask,
    destinationLabel,
    destinationMask,
    sourceOwnership,
    legalName,
  };
}

async function saveSetup(ownerId: string, raw: any) {
  const setup = validateSetup(raw);
  const existing = await activeSetup(ownerId);
  const values = {
    source_mask: setup.sourceMask,
    destination_label: setup.destinationLabel,
    destination_mask: setup.destinationMask,
    source_ownership: setup.sourceOwnership,
    legal_name: setup.legalName,
    accepted_by_amex: true,
    confirmed_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin.database
      .from('amex_bank_setups')
      .update(values)
      .eq('id', existing.id)
      .eq('owner_id', ownerId);
    if (error) throw error;
  } else {
    const { error } = await admin.database
      .from('amex_bank_setups')
      .insert([{ owner_id: ownerId, ...values }]);
    if (error) throw error;
  }

  return dashboard(ownerId);
}

function validatePlan(raw: any) {
  const amount = Number(raw?.amount);
  const cadence = raw?.cadence as Cadence;
  const scheduledFor = new Date(raw?.scheduledFor);
  const memo = String(raw?.memo || '').trim();
  const reference = String(raw?.amexConfirmationReference || '').trim();
  const confirmationText = String(raw?.confirmationText || '').trim();
  const confirmationVersion = String(raw?.confirmationVersion || '').trim();

  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) {
    throw new Error('Invalid transfer amount.');
  }
  if (!['one_time', 'weekly', 'biweekly', 'monthly'].includes(cadence)) {
    throw new Error('Invalid transfer frequency.');
  }
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor <= new Date()) {
    throw new Error('The first transfer date must be in the future.');
  }
  if (memo.length > 140) throw new Error('Memo is too long.');
  if (reference.length > 100) {
    throw new Error('AMEX confirmation reference is too long.');
  }
  if (!confirmationText || !confirmationVersion) {
    throw new Error('AMEX confirmation record is required.');
  }
  if (raw?.confirmedInAmex !== true) {
    throw new Error('Confirm that the matching transfer exists in AMEX.');
  }

  return {
    amount: amount.toFixed(2),
    cadence,
    scheduledFor: scheduledFor.toISOString(),
    memo: memo || null,
    reference: reference || null,
    confirmationText,
    confirmationVersion,
  };
}

async function savePlan(
  ownerId: string,
  req: Request,
  raw: any,
) {
  const setup = await activeSetup(ownerId);
  if (!setup || setup.accepted_by_amex !== true) {
    throw new Error('Record the verified AMEX bank setup first.');
  }

  const plan = validatePlan(raw);
  const { data, error } = await admin.database
    .from('amex_transfer_plans')
    .insert([
      {
        owner_id: ownerId,
        setup_id: setup.id,
        source_mask: setup.source_mask,
        destination_label: setup.destination_label,
        destination_mask: setup.destination_mask,
        source_ownership: setup.source_ownership,
        legal_name: setup.legal_name,
        amount: plan.amount,
        memo: plan.memo,
        cadence: plan.cadence,
        scheduled_for: plan.scheduledFor,
        status: 'recorded_in_amex',
        amex_confirmation_reference: plan.reference,
        confirmation_text: plan.confirmationText,
        confirmation_version: plan.confirmationVersion,
        confirmed_at: new Date().toISOString(),
        confirmation_ip: clientIp(req),
        confirmation_user_agent: req.headers.get('user-agent'),
      },
    ])
    .select('id, status')
    .single();

  if (error) throw error;

  return {
    planId: data.id,
    status: data.status,
    message:
      'Live AMEX transfer plan recorded. American Express—not this app—executes the transfer.',
  };
}

export default async function(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, origin);
  }
  if (origin !== appOrigin) {
    return jsonResponse({ error: 'Origin not allowed.' }, 403, origin);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '');
    const user = await authenticatedUser(req);

    if (action === 'dashboard') {
      return jsonResponse(await dashboard(user.id), 200, origin);
    }
    if (action === 'save_bank_setup') {
      return jsonResponse(
        await saveSetup(user.id, body.setup),
        200,
        origin,
      );
    }
    if (action === 'save_transfer_plan') {
      return jsonResponse(
        await savePlan(user.id, req, body.draft),
        200,
        origin,
      );
    }

    return jsonResponse({ error: 'Unknown action.' }, 400, origin);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error.';
    const status = message === 'Unauthorized' ? 401 : 400;
    return jsonResponse({ error: message }, status, origin);
  }
}
