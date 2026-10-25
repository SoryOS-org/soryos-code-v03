/**
 * LRU Cache implementation with O(1) get and put operations.
* Uses a combination of a hash map (for O(1) lookup) and a doubly linked list
* (to maintain access order: most recently used at head, least recently used at tail).
 */
import { v4 as uuid } from "uuid";

// Node in the doubly linked list
class ListNode<T> {
  constructor(
    public key: string,
    public value: T,
    public prev: ListNode<T> | null = null,
    public next: ListNode<T> | null = null,
  ) {
    this.key = key;
    this.value = value;
  }
}

/**
 * LRU Cache
 *
 * @template T Value type stored in the cache
 * @param capacity Maximum number of items the cache can hold
 */
export class LRUCache<T> {
  private readonly capacity: number;
  private readonly map: Map<string, ListNode<T>>;
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('LRUCache capacity must be positive');
    }
    this.capacity = capacity;
    this.map = new Map();
  }

  /**
   * Retrieve a value by key. If not found, returns undefined.
   * Moving a accessed item to the front makes it the most recently used.
   * Time complexity: O(1)
   */
  get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) {
      return undefined;
    }
    // Remove from current position
    this._remove(node);
    // Insert at head (most recently used)
    this._addToHead(node);
    return node.value;
  }

  /**
   * Insert or update a key-value pair.
   * If the key already exists, it's updated and moved to the front.
   * If the cache is at capacity, the least recently used item is evicted.
   * Time complexity: O(1)
   */
  put(key: string, value: T): void {
    const existing = this.map.get(key);
    if (existing) {
      // Update existing key - remove and re-add to mark as recently used
      this._remove(existing);
    }

    const newNode = new ListNode(key, value);
    this.map.set(key, newNode);

    if (this.head === null) {
      // First item - also becomes the tail
      this.head = newNode;
      this.tail = newNode;
    } else {
      // Insert after head
      newNode.prev = this.head;
      this.head.prev = newNode;
      this.head = newNode;
    }

    // Evict least recently used if over capacity
    if (this.map.size > this.capacity) {
      const lru = this.tail!;
      this._remove(lru);
      this.map.delete(lru.key);
    }
  }

  /**
   * Remove a node from the linked list.
   * Time complexity: O(1)
   */
  private _remove(node: ListNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // node was head
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      // node was tail
      this.tail = node.prev;
    }
  }

  /**
   * Add a node to the head (most recently used).
   * Time complexity: O(1)
   */
  private _addToHead(node: ListNode<T>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head !== null) {
      this.head.prev = node;
    } else {
      // Empty list
      this.tail = node;
    }
    this.head = node;
  }

  /**
   * Check if a key exists in the cache.
   * Time complexity: O(1)
   */
  has(key: string): boolean {
    return this.map.has(key);
  }

  /**
   * Get the current size of the cache.
   * Time complexity: O(1)
   */
  size(): number {
    return this.map.size;
  }

  /**
   * Clear all items from the cache.
   * Time complexity: O(n) where n is the number of items
   */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }
}

export default LRUCache;