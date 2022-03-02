from time import time
from typing import Dict

from prometheus_client import Histogram


class PrometheusMetric:
    histograms: Dict[str, Histogram] = {}

    def __init__(self, name, description, labelnames=()):
        self.start_time = time()

        # set metric prefix of audius_project_
        name = f"audius_dn_{name}"

        # CollectorRegistries must be uniquely named
        if name not in PrometheusMetric.histograms:
            # NOTE: we only set labelnames once.
            # unsure if overloading is supported.
            PrometheusMetric.histograms[name] = Histogram(
                name, description, labelnames=labelnames
            )
        self.h = PrometheusMetric.histograms[name]

    def elapsed(self):
        return time() - self.start_time

    def save_time(self, labels=None):
        self.save(self.elapsed(), labels)

    def save(self, value, labels=None):
        if labels:
            self.h.labels(**labels).observe(value)
        else:
            self.h.observe(value)
