import { LRUCache } from "./cache";

describe("LRUCache", () => {
  test("get returns value for existing key", () => {
    const cache = new LRUCache(2);
    cache.put("key1", "value1");
    cache.put("key2", "value2");
    expect(cache.get("key1")).toBe("value1");
    expect(cache.get("key2")).toBe("value2");
  });

  test("get returns undefined for missing key", () => {
    const cache = new LRUCache(2);
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  test("put updates existing key and moves to front", () => {
    const cache = new LRUCache(2);
    cache.put("key1", "value1");
    cache.put("key2", "value2");
    cache.put("key1", "updated_value1"); // update existing
    expect(cache.get("key1")).toBe("updated_value1");
  });

  test("evicts least recently used when at capacity", () => {
    const cache = new LRUCache(2);
    cache.put("key1", "value1");
    cache.put("key2", "value2");
    // Adding a third item should evict key2 (least recently used)
    cache.put("key3", "value3");
    expect(cache.get("key1")).toBe("value1");
    expect(cache.get("key2")).toBeUndefined(); // evicted
    expect(cache.get("key3")).toBe("value3");
  });

  test("size reports correct count", () => {
    const cache = new LRUCache(5);
    expect(cache.size()).toBe(0);
    cache.put("k1", "v1");
    expect(cache.size()).toBe(1);
    cache.put("k2", "v2");
    expect(cache.size()).toBe(2);
    cache.put("k3", "v3");
    expect(cache.size()).toBe(3);
  });
});
