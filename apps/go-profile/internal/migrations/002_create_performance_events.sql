CREATE TABLE IF NOT EXISTS performance_event (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    event_index INTEGER NOT NULL,
    anonymous_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    route TEXT NOT NULL,
    api_name TEXT,
    release TEXT,
    sdk_version TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    api_status INTEGER,
    duration_ms DOUBLE PRECISION,
    fcp_ms DOUBLE PRECISION,
    lcp_ms DOUBLE PRECISION,
    inp_ms DOUBLE PRECISION,
    cls DOUBLE PRECISION,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT performance_event_type_check CHECK (event_type IN ('page_view', 'web_vital', 'api_request', 'client_error'))
);

CREATE INDEX IF NOT EXISTS performance_event_occurred_at_idx
    ON performance_event(occurred_at DESC);

CREATE INDEX IF NOT EXISTS performance_event_route_event_type_idx
    ON performance_event(route, event_type);

CREATE INDEX IF NOT EXISTS performance_event_api_name_idx
    ON performance_event(api_name)
    WHERE api_name IS NOT NULL;
