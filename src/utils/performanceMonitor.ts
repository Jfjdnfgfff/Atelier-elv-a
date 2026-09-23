export interface PerformanceMetrics {
  startupTimeMs: number;
  timeToFirstUsableUIMs: number;
  appRenderCount: number;
  appNavRenderCount: number;
  viewRenderCounts: Record<string, number>;
  navigationLatencies: { from: string; to: string; latencyMs: number }[];
  lastNavigationLatencyMs: number;
  localStorageReads: number;
  localStorageWrites: number;
  startupCollectionsLoaded: string[];
  startupRecordCount: number;
}

class PerformanceMonitorService {
  private startTime: number = typeof performance !== 'undefined' ? performance.now() : Date.now();
  private firstUsableUITime: number = 0;
  private appRenderCount: number = 0;
  private appNavRenderCount: number = 0;
  private viewRenderCounts: Record<string, number> = {};
  private navigationLatencies: { from: string; to: string; latencyMs: number }[] = [];
  private navStartTime: number = 0;
  private navFromView: string = '';
  private navToView: string = '';
  private lastNavigationLatencyMs: number = 0;
  private localStorageReads: number = 0;
  private localStorageWrites: number = 0;
  private startupCollections: string[] = ['clothes', 'staffMembers', 'staffAbsences', 'caisseClosures'];
  private startupRecordCount: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      (window as any).__GET_PERF_METRICS__ = () => this.getMetrics();
      (window as any).__PRINT_PERF_REPORT__ = () => this.printReport();
    }
  }

  markFirstUsableUI(recordCount: number = 0) {
    if (this.firstUsableUITime === 0) {
      this.firstUsableUITime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.startTime;
      this.startupRecordCount = recordCount;
      console.log(`⚡ [Performance] First Usable UI ready in ${this.firstUsableUITime.toFixed(1)}ms (${recordCount} core records from cache)`);
    }
  }

  recordAppRender() {
    this.appRenderCount++;
  }

  recordAppNavRender() {
    this.appNavRenderCount++;
  }

  recordViewRender(view: string) {
    this.viewRenderCounts[view] = (this.viewRenderCounts[view] || 0) + 1;
  }

  startNavigation(from: string, to: string) {
    this.navStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.navFromView = from;
    this.navToView = to;
  }

  endNavigation(to: string) {
    if (this.navStartTime > 0 && this.navToView === to) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const latencyMs = now - this.navStartTime;
      this.lastNavigationLatencyMs = latencyMs;
      this.navigationLatencies.push({
        from: this.navFromView,
        to: this.navToView,
        latencyMs
      });
      this.navStartTime = 0;
      console.log(`🚀 [Navigation] ${this.navFromView} ➔ ${this.navToView}: ${latencyMs.toFixed(1)}ms`);
    }
  }

  recordStorageRead(key: string) {
    this.localStorageReads++;
  }

  recordStorageWrite(key: string) {
    this.localStorageWrites++;
  }

  getMetrics(): PerformanceMetrics {
    return {
      startupTimeMs: typeof performance !== 'undefined' ? performance.now() - this.startTime : 0,
      timeToFirstUsableUIMs: this.firstUsableUITime,
      appRenderCount: this.appRenderCount,
      appNavRenderCount: this.appNavRenderCount,
      viewRenderCounts: { ...this.viewRenderCounts },
      navigationLatencies: [...this.navigationLatencies],
      lastNavigationLatencyMs: this.lastNavigationLatencyMs,
      localStorageReads: this.localStorageReads,
      localStorageWrites: this.localStorageWrites,
      startupCollectionsLoaded: [...this.startupCollections],
      startupRecordCount: this.startupRecordCount
    };
  }

  printReport() {
    const m = this.getMetrics();
    console.table({
      'Startup Time to UI': `${m.timeToFirstUsableUIMs.toFixed(1)} ms`,
      'App Render Count': m.appRenderCount,
      'AppNav Render Count': m.appNavRenderCount,
      'LocalStorage Reads': m.localStorageReads,
      'LocalStorage Writes': m.localStorageWrites,
      'Startup Collections Loaded': m.startupCollectionsLoaded.join(', '),
      'Startup Records Loaded': m.startupRecordCount,
      'Last Navigation Latency': `${m.lastNavigationLatencyMs.toFixed(1)} ms`
    });
    return m;
  }
}

export const perfMonitor = new PerformanceMonitorService();
