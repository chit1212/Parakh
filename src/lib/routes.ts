// Addresses shared by server and browser code. Compare is the home screen (design: App shell).
export const EVENT_ID = "SE-2026-041";
export const HOME = `/events/${EVENT_ID}/compare`;
export const RULES = `/events/${EVENT_ID}/rfq?tab=rules`;
/** The buyer's target award date for the demo event (set by the buyer; not in the dataset). */
export const AWARD_BY = "15 Oct";

/** The people on the demo event (from the RFQ). Shared so every screen names them the same way. */
export const PEOPLE = {
  company: "Sahyadri Appliances",
  buyer: { name: "Vikram Deshpande", role: "Category Buyer, Packaging" },
  vp: { name: "Meera Kulkarni", role: "VP, Procurement" },
};
