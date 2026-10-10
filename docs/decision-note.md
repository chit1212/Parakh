# Parakh: what I decided, and what I left out

*Draft for Chitrangna to edit. One page.*

**The bet.** Buyers retype quotes because they optimise for accuracy, not time. So I didn't try to save time by trading accuracy away. Parakh reads everything, but the buyer only has to look at the numbers that could change who wins. Principle: **AI reads, code calculates, independent checks verify, the buyer decides.**

## What I decided, and why

1. **The model never does arithmetic.** Gemini reads each reply into a strict schema: wording, raw value, unit, currency, basis, and a source locator. Code then does every conversion: per 100, per kg from box weight, USD at a dated reference rate, freight and handling. Each number shows its sum. A wrong multiplication is a bug I can test; a wrong guess is not.
2. **No source, no entry.** For text formats, code checks that every snippet the model cites is really in the file. If not, the number never enters the grid. For the photo, the buyer sees the area the reader marked, because code can't verify an image.
3. **Interrupt only when a winner could change.** Every doubt is re-solved with its other reading, in the cheapest-overall view and the quality-cleared view. It's raised only if the winner changes, and ranked by rupees at stake. Everything else is logged with a count. Today that's 4 doubts and 16 logged checks, out of 150 prices.
4. **Never guess silently.** A conditional discount is kept apart, not applied. Unknown freight is compared before freight and raised as a doubt; it isn't estimated. A hand-corrected digit gets both readings tested. "Same as last year" is labelled as last year's price.
5. **The chat chooses rules; code solves.** Each question becomes structured rules (eligibility, exclusions, vendor limit, share cap, doubt pricing, fixed lines). The solver runs them, and the table switches to the answer. Two model calls at most, streamed, in under 10 seconds. A fixed library of six award strategies is always one click away.
6. **The buyer decides, on the record.** Approving a price, accepting a substitute, approving a below-cost price, and overriding a line each record who, when and why. The award freezes a snapshot with that audit trail, and the Excel and PDF carry it.
7. **Quality is scored, not just ticked.** I drafted a marking scheme for the RFQ's eight questions, editable in plain words, and code marks every answer. Cleared means both mandatory items pass and the score is at least 70.
8. **Free to run.** I used Gemini's free tier instead of a paid model. The five demo replies open from saved readings, which are the pipeline's own output, stamped with date and model. Uploads, "Read again live" and the chat call the model live.

## What I deliberately left out

- **A second, independent read of every document.** It would roughly double AI cost. Today a "checked" price means read once and passed the code checks. I'd add a second read only for the doubts that matter.
- **Real email in and out.** Sending the RFQ and vendor emails is stubbed, and replies are uploaded by hand. Nothing ever goes to a vendor without the buyer's approval.
- **A database and accounts.** State lives in the browser; the buyer/VP switch is a demo stand-in for real permissions.
- **Keeping uploaded files on the server.** The source panel shows the exact words read from an upload, but not the page itself.
- **Building a brand-new RFQ end to end.** You can draft and "send" one, but the comparison runs on the demo event's 30 lines.
- **Editable conversion and should-cost rules.** They're shown, but only the quality marking is editable.

## What I think the bigger problem is

Reading quotes is close to solved. The hard part is **the decisions in between**: which doubts deserve a phone call, which substitutes are acceptable, and who signed off on what. That's why most of the product is about ranking doubts by rupees, and about recording decisions so a ₹4 crore award can be defended later.
