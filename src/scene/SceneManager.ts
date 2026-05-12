/**
 * SceneManager — owns the list of SceneNodes and provides a simple API
 * for adding, removing, and finding renderable objects.
 *
 * No GPU state lives here.  FurRenderer reads from getNodes() each frame
 * and maintains matching GPUNodeData entries.
 */

import { SceneNode, type SceneNodeOptions } from './SceneNode';
import type { InterleavedGeometry } from '../utils/GeometryUtils';

export class SceneManager {
  private readonly _nodes: SceneNode[] = [];

  /** All nodes in insertion order. */
  get nodes(): readonly SceneNode[] { return this._nodes; }

  /**
   * Add a new node to the scene.
   * @returns the new node so you can configure it immediately.
   */
  add(name: string, geometry: InterleavedGeometry, opts: SceneNodeOptions = {}): SceneNode {
    const node = new SceneNode(geometry, { name, ...opts });
    this._nodes.push(node);
    return node;
  }

  /** Remove a node and return true if it was found. */
  remove(node: SceneNode): boolean {
    const idx = this._nodes.indexOf(node);
    if (idx === -1) return false;
    this._nodes.splice(idx, 1);
    return true;
  }

  /** Find the first node with the given name, or undefined. */
  find(name: string): SceneNode | undefined {
    return this._nodes.find(n => n.name === name);
  }

  /** Remove all nodes. */
  clear(): void { this._nodes.length = 0; }
}
