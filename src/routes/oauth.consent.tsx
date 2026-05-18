import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type AuthorizationDetails = {
  client_id?: string;
  client_name?: string;
  redirect_uri?: string;
  scope?: string;
};

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search.authorization_id === "string" ? search.authorization_id : "",
  }),
  component: OAuthConsentPage,
  head: () => ({
    meta: [{ title: "OAuth Consent" }],
  }),
});

function OAuthConsentPage() {
  const { authorization_id } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!authorization_id) {
        if (active) {
          setError("Missing authorization_id.");
          setLoading(false);
        }
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        if (active) {
          setNeedsLogin(true);
          setLoading(false);
        }
        return;
      }

      const oauth = (supabase.auth as unknown as {
        oauth?: {
          getAuthorizationDetails: (authorizationId: string) => Promise<{
            data: AuthorizationDetails | null;
            error: { message: string } | null;
          }>;
        };
      }).oauth;

      if (!oauth?.getAuthorizationDetails) {
        if (active) {
          setError("Supabase OAuth client support is not available in this build.");
          setLoading(false);
        }
        return;
      }

      const { data, error: detailsError } = await oauth.getAuthorizationDetails(
        authorization_id,
      );

      if (!active) return;

      if (detailsError) {
        setError(detailsError.message);
      } else {
        setDetails(data);
      }
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [authorization_id]);

  const redirectToLogin = () => {
    const redirect = encodeURIComponent(
      `/oauth/consent?authorization_id=${encodeURIComponent(authorization_id)}`,
    );
    window.location.href = `/login?redirect=${redirect}`;
  };

  const handleDecision = async (decision: "approve" | "deny") => {
    const oauth = (supabase.auth as unknown as {
      oauth?: {
        approveAuthorization: (authorizationId: string) => Promise<{
          data: { redirect_to?: string } | null;
          error: { message: string } | null;
        }>;
        denyAuthorization: (authorizationId: string) => Promise<{
          data: { redirect_to?: string } | null;
          error: { message: string } | null;
        }>;
      };
    }).oauth;

    if (!oauth) {
      setError("Supabase OAuth client support is not available in this build.");
      return;
    }

    setSubmitting(decision);
    setError(null);

    const result =
      decision === "approve"
        ? await oauth.approveAuthorization(authorization_id)
        : await oauth.denyAuthorization(authorization_id);

    if (result.error) {
      setError(result.error.message);
      setSubmitting(null);
      return;
    }

    const redirectTo = result.data?.redirect_to;
    if (!redirectTo) {
      setError("Supabase did not return a redirect URL.");
      setSubmitting(null);
      return;
    }

    window.location.href = redirectTo;
  };

  const scopes = details?.scope?.split(" ").filter(Boolean) ?? [];

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            OAuth Consent
          </p>
          <h1 className="text-2xl font-semibold">Authorize application access</h1>
          <p className="text-sm text-muted-foreground">
            Review the application request before granting access to your account.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading authorization request...</p>
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && needsLogin ? (
          <div className="space-y-4 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              You need to sign in before you can approve this OAuth request.
            </p>
            <Button onClick={redirectToLogin}>Go to login</Button>
          </div>
        ) : null}

        {!loading && !error && !needsLogin && details ? (
          <>
            <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <div>
                <p className="text-muted-foreground">Application</p>
                <p className="font-medium">
                  {details.client_name || details.client_id || "Unknown client"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Redirect URI</p>
                <p className="break-all font-medium">{details.redirect_uri || "Not provided"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Requested scopes</p>
                {scopes.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium">No scopes requested</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="sm:flex-1"
                disabled={submitting !== null}
                onClick={() => void handleDecision("approve")}
              >
                {submitting === "approve" ? "Approving..." : "Approve access"}
              </Button>
              <Button
                className="sm:flex-1"
                disabled={submitting !== null}
                onClick={() => void handleDecision("deny")}
                variant="outline"
              >
                {submitting === "deny" ? "Denying..." : "Deny"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
