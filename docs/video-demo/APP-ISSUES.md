# App findings encountered during filming

## Emergency wording was routed as routine

On the deployed app, the input `sumasakit ang dibdib at hirap huminga mula kaninang umaga` produced General Medicine / Routine. This finding is about observed software behavior, not a clinical evaluation. The capture is retained in the source footage, not the final demo.

The fallback emergency keywords in frontend/src/lib/triageFallback.js include `sakit ng dibdib` and `hindi makahinga`, but do not include `sumasakit ang dibdib` or `hirap huminga`. The observed result alone does not establish whether the failing decision came from the live AI, its sanitization, or a fallback, because the first response logger only retained status 200 whereas successful triage creation uses 201. Verify the backend and frontend safety rules together, including common Tagalog variants and negation, before using this emergency example in a live presentation or patient-facing deployment.

## Billing description is static

The sample visit was Dermatology, but the billing dictionary still displays `Consultation, Cardiology`. The film preserves the actual UI and discusses the consultation and facility charge without claiming that label is dynamic. Bind the label to the booked appointment if this is unintended.

## Demo integration boundaries

The UI explicitly labels benefits as `demo · pending integration`. Government-side eReport status is deliberately not mirrored. Face Liveness hosted-session tokens and eVerify SDK session IDs are not interchangeable. These distinctions are preserved in the film.

No application fixes were deployed as part of this video task.

## Follow-up capture observations

A later live call with the same skin/rash wording returned Dermatology with urgent urgency; the earlier recorded response showed routine urgency. The film preserves the recorded result and the nurse-confirmation disclaimer rather than claiming deterministic clinical routing.

The GrabPay test channel returned a communication error. The user identified Cash Payments as the working test method. That flow completed with Mark as Paid, a visible Transaction Success/PAID screen, and a confirmed paid status after returning to eGovMed. No real money was transferred.

The app's payment-return display derives its amount from the standard consultation and active sample benefits. An ad-hoc 300-peso test bill with no benefits therefore initially displayed 750 on return. The final demonstration uses the standard 750-peso bill with the sample PhilHealth450 deduction, so checkout and app return both show300. The ad-hoc amount-display behavior remains an application finding; no UI amount was painted over in the film.

The app says a receipt has been texted after payment and creates an in-app confirmation notification. The recording confirms the paid transaction and that in-app event, but does not independently establish SMS receipt delivery.

Some decorative assets in the hosted gateway do not load. The final edit preserves transaction values and controls and uses the working cash path.
