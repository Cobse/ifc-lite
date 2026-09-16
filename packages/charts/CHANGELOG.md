# @ifc-lite/charts

## 0.2.1

### Patch Changes

- [#4853](https://github.com/LTplus-AG/ifc-lite/pull/4853) [`3d68de9`](https://github.com/LTplus-AG/ifc-lite/commit/3d68de95ba3cb19921623873b9d70a6e17bcc836) Thanks [@louistrue](https://github.com/louistrue)! - Expose synthetic top-N Other bucket identity so consumers can distinguish it from literal category values with the same key.

## 0.2.0

### Minor Changes

- [#4569](https://github.com/LTplus-AG/ifc-lite/pull/4569) [`8d8f484`](https://github.com/LTplus-AG/ifc-lite/commit/8d8f484834fd808201b0dcedbc6df32d1d6daeb7) Thanks [@louistrue](https://github.com/louistrue)! - New package: headless chart data binding for the viewer's charts panel ([#3944](https://github.com/LTplus-AG/ifc-lite/issues/3944)). `aggregate` buckets a dataset by a spec (count / sum, stacked, topN + Other, histogram bins, ISO-week timelines, cross-filter slice) while keeping every bucket's element ids, so a chart click maps to elements and a 3D selection maps back to buckets; `elementsDataset` reads IfcType / Storey / Model / Name straight off a model's entity table; `buildEChartsOption` and `renderChartSvg` (ECharts SSR, no DOM) render it; `validateDashboardSpec` checks saved dashboards and report templates.
