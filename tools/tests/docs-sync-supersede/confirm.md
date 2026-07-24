Yes — the switch from PostgreSQL to Redis is intentional and accepted; go ahead. Create the replacement decision as `docs/payments/decisions/token-store-redis.md`, mark the old PostgreSQL decision as superseded and linked to the replacement, and record the deprecation in the nearest log. Keep the old decision's content intact — do not rewrite it.

Do the whole thing in the working tree; do not stage, commit, push, or open a pull request.
