// The demo event as code sees it on the server: saved readings -> grid, quality, doubts.
import { buildGrid, type Grid } from "./compare";
import { findDoubts, type DoubtReport } from "./doubts";
import { loadDemoInbox } from "./inbox";
import { qualityOf, type Quality } from "./quality";
import { loadEvent, loadHistory } from "./rfq";
import { loadSavedReadings } from "./saved";
import type { SourcingEvent } from "./types";

export interface EventState { ev: SourcingEvent; grid: Grid; quality: Quality[]; report: DoubtReport }

let cached: Promise<EventState> | null = null;

export function loadEventState(): Promise<EventState> {
  cached ??= (async () => {
    const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
    const readings = Object.values(await loadSavedReadings(inbox));
    const grid = buildGrid(ev, readings, history, {}, history.lines);
    const quality = ev.vendors.map((v) => qualityOf(ev, v.id, readings));
    const report = findDoubts(ev, grid, quality.filter((q) => q.cleared).map((q) => q.vendorId));
    return { ev, grid, quality, report };
  })();
  return cached;
}
