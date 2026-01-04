from __future__ import annotations

from collections import defaultdict
from math import inf
from typing import Dict, Iterable, Iterator, List, Set, Tuple, Union, Any


class Graph:
    def __init__(self):
        self._adj: Dict[Any, Set[Any]] = defaultdict(set)

    def add_node(self, node: Any) -> None:
        self._adj.setdefault(node, set())

    def add_nodes_from(self, nodes: Iterable[Any]) -> None:
        for node in nodes:
            self.add_node(node)

    def add_edge(self, u: Any, v: Any) -> None:
        self.add_node(u)
        self.add_node(v)
        self._adj[u].add(v)
        self._adj[v].add(u)

    def add_edges_from(self, edges: Iterable[Tuple[Any, Any]]) -> None:
        for u, v in edges:
            self.add_edge(u, v)

    def neighbors(self, node: Any) -> Iterator[Any]:
        return iter(self._adj.get(node, ()))

    def edges(self, nbunch: Union[None, Any, Iterable[Any]] = None) -> List[Tuple[Any, Any]]:
        edges: List[Tuple[Any, Any]] = []
        if nbunch is None:
            seen = set()
            for u, nbrs in self._adj.items():
                for v in nbrs:
                    edge = (min(u, v), max(u, v))
                    if edge not in seen:
                        seen.add(edge)
                        edges.append(edge)
            return edges

        if isinstance(nbunch, (list, tuple, set)):
            nodes = nbunch
        else:
            nodes = [nbunch]
        for u in nodes:
            for v in self._adj.get(u, ()):
                edges.append((u, v))
        return edges

    def subgraph(self, nodes: Iterable[Any]) -> "Graph":
        nodes_set = set(nodes)
        sub = Graph()
        sub.add_nodes_from(nodes_set)
        for u in nodes_set:
            for v in self._adj.get(u, ()):
                if v in nodes_set:
                    sub.add_edge(u, v)
        return sub

    def __contains__(self, node: Any) -> bool:
        return node in self._adj

    def nodes(self) -> List[Any]:
        return list(self._adj.keys())


def floyd_warshall(graph: Graph) -> Dict[Any, Dict[Any, float]]:
    nodes = graph.nodes()
    dist: Dict[Any, Dict[Any, float]] = {
        u: {v: inf for v in nodes} for u in nodes
    }
    for u in nodes:
        dist[u][u] = 0
        for v in graph.neighbors(u):
            dist[u][v] = 1

    for k in nodes:
        for i in nodes:
            dik = dist[i][k]
            if dik == inf:
                continue
            for j in nodes:
                new_distance = dik + dist[k][j]
                if new_distance < dist[i][j]:
                    dist[i][j] = new_distance
    return dist
