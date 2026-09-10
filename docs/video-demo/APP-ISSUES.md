# App findings encountered during filming

## Emergency wording was routed as routine

On the deployed app, the input `sumasakit ang dibdib at hirap huminga mula kaninang umaga` produced General Medicine / Routine. This finding is about observed software behavior, not a clinical evaluation. The capture is retained in the source footage, not the final demo.

The fallback emergency keywords in frontend/src/lib/triageFallback.js include `sakit ng dibdib` and `hindi makahinga`, but do not include `sumasakit ang dibdib` or `hirap huminga`. The observed result alone does not establish whether the failing decision came from the live AI, its sanitization, or a fallback, because the first response logger only retained status 200 whereas successful triage creation uses 201. Verify the backend and frontend safety rules together, including common Tagalog variants and negation, before using this emergency example in a live presentation or patient-facing deployment.

## Billing description is static

The sample visit was Dermatology, but the billing dictionary still displays `Consultation, Cardiology`. The film preserves the actual UI and discusses the consultation and facility charge without claiming that label is dynamic. Bind the label to the booked appointment if this is unintended.

## Demo integration boundaries

The UI explicitly labels benefits as `demo · pending integration`. Government-side eReport status is deliberately not mirrored. Face Liveness hosted-session tokens and eVerify SDK session IDs are not interchangeable. These distinctions are preserved in the film.

No application fixes were deployed as part of this video task.
