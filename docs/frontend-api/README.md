# Frontend API docs

The API each side of the DMP Researcher frontend needs, one page per role:
every page, how many inputs it asks for, and the endpoints behind it. The
format follows the [Stripe API reference](https://docs.stripe.com/api/v2/core/accounts).

| Role | Page | Status |
| --- | --- | --- |
| Committee | [committee.md](./committee.md) | Done |
| Researcher | researcher.md | To do |

These are **proposed contracts**: the frontend currently runs on browser-held
stores, and each endpoint names the store call it replaces. Field names match
[the ERD](../project-erd.md).
