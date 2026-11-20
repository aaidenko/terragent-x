import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def pytest_addoption(parser):
    parser.addoption("--network", action="store_true", help="run Planetary Computer smoke tests")


def pytest_collection_modifyitems(config, items):
    import pytest

    if config.getoption("--network") or os.environ.get("TERRAGENT_NETWORK_TESTS") == "1":
        return
    skip = pytest.mark.skip(reason="network test: pass --network or TERRAGENT_NETWORK_TESTS=1")
    for item in items:
        if "network" in item.keywords:
            item.add_marker(skip)
