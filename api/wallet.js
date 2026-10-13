'use strict';
// Coins and Evolution. Coins are earned by activity only (no real money, not convertible, not transferable).
// Everything is counted here, on the server. The client only asks.
const L = require('./_lib');
const S = require('./_store');

const DAILY_CAP = 30;
const COSTS = [300, 900, 2700];          // price of Evolution level 1, 2, 3
const MULT = [1, 1.5, 2, 3];             // personal daily AI limit multiplier per level
const NEW_DEVICES_PER_IP = 5;            // new device ids per IP per day; extra ones can use the product but earn nothing
const RULES = {
  visit: { amt: 3, once: (d, day) => 'o:visit:' + d + ':' + day, ttl: 172800 },
  dna: { amt: 10, once: (d, day) => 'o:dna:' + d + ':' + day, ttl: 172800 },
  chday: { amt: 5, once: (d, day, p) => 'o:ch:' + d + ':' + p.pid + ':' + p.n, ttl: 34560000 }
};

const isDevice = (s) => typeof s === 'string' && /^[a-f0-9]{32}$/.test(s);
const today = () => new Date().toISOString().slice(0, 10);

const EARN = `
local day = ARGV[1]; local amt = tonumber(ARGV[2]); local cap = tonumber(ARGV[3])
if redis.call('HGET', KEYS[1], 'day') ~= day then redis.call('HSET', KEYS[1], 'day', day, 'today', 0) end
if redis.call('HGET', KEYS[1], 'restricted') == '1' then return {0, 3} end
local t = tonumber(redis.call('HGET', KEYS[1], 'today') or '0')
local room = cap - t
if room <= 0 then return {0, 0} end
if amt > room then amt = room end
if ARGV[4] ~= '' then
  local ok = redis.call('SET', ARGV[4], '1', 'NX', 'EX', ARGV[5])
  if not ok then return {0, 1} end
end
redis.call('HINCRBY', KEYS[1], 'today', amt); redis.call('HINCRBY', KEYS[1], 'coins', amt)
return {amt, 2}`;

const EVOLVE = `
local l = tonumber(redis.call('HGET', KEYS[1], 'evo') or '0')
local cost = tonumber(ARGV[l + 1])
if not cost then return {-1, l} end
local c = tonumber(redis.call('HGET', KEYS[1], 'coins') or '0')
if c < cost then return {-2, l} end
redis.call('HINCRBY', KEYS[1], 'coins', -cost); redis.call('HSET', KEYS[1], 'evo', l + 1)
return {1, l + 1}`;

// Makes sure the device exists; marks it restricted when its IP already created too many devices today.
async function ensure(dev, ip) {
  const key = 'd:' + dev;
  const [created] = await S.pipe([['HGET', key, 'created']]);
  if (created) return key;
  const day = today();
  const ipk = 'ipd:' + ip + ':' + day;
  const r = await S.pipe([['SADD', ipk, dev], ['SCARD', ipk], ['EXPIRE', ipk, 172800]]);
  const restricted = Number(r[1]) > NEW_DEVICES_PER_IP ? '1' : '0';
  await S.pipe([['HSETNX', key, 'created', String(Date.now())], ['HSETNX', key, 'restricted', restricted], ['HSETNX', key, 'coins', '0'], ['HSETNX', key, 'evo', '0']]);
  return key;
}

async function state(key) {
  const [h] = await S.pipe([['HGETALL', key]]);
  const o = {};
  for (let i = 0; i < h.length; i += 2) o[h[i]] = h[i + 1];
  const evo = Math.min(COSTS.length, Number(o.evo) || 0);
  const day = today();
  return {
    coins: Number(o.coins) || 0, level: evo, maxLevel: COSTS.length,
    costs: COSTS, nextCost: evo < COSTS.length ? COSTS[evo] : null,
    mult: MULT[evo], nextMult: evo < COSTS.length ? MULT[evo + 1] : null,
    earnedToday: o.day === day ? Number(o.today) || 0 : 0, dailyCap: DAILY_CAP,
    restricted: o.restricted === '1'
  };
}

// Used by the AI guard: personal multiplier for a device (1 when unknown or storage is off).
async function multiplier(dev) {
  if (!S.configured() || !isDevice(dev)) return 1;
  try { const [lv] = await S.pipe([['HGET', 'd:' + dev, 'evo']]); return MULT[Math.min(COSTS.length, Number(lv) || 0)] || 1; }
  catch (e) { return 1; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.fail(res, 405, 'method');
  if (!S.configured()) return L.fail(res, 503, 'storage', 'Coins are not available yet');
  const b = await L.readBody(req);
  if (!isDevice(b.device)) return L.fail(res, 400, 'device');
  const ip = L.ipOf(req);
  try {
    const key = await ensure(b.device, ip);
    const op = String(b.op || 'state');
    if (op === 'state') return L.send(res, 200, await state(key));
    if (op === 'earn') {
      const rule = RULES[b.action];
      if (!rule) return L.fail(res, 400, 'action');
      const p = { pid: L.clip(b.pid, 20).replace(/[^a-z0-9_-]/gi, ''), n: Math.floor(Number(b.day)) };
      if (b.action === 'chday' && (!p.pid || !(p.n >= 1 && p.n <= 60))) return L.fail(res, 400, 'input');
      const day = today();
      const r = await S.pipe([['EVAL', EARN, '1', key, day, String(rule.amt), String(DAILY_CAP), rule.once(b.device, day, p), String(rule.ttl)]]);
      const st = await state(key);
      st.gained = Number(r[0][0]) || 0;
      return L.send(res, 200, st);
    }
    if (op === 'evolve') {
      const r = await S.pipe([['EVAL', EVOLVE, '1', key].concat(COSTS.map(String))]);
      const code = Number(r[0][0]);
      const st = await state(key);
      if (code === -1) return L.send(res, 409, Object.assign(st, { error: 'max', message: 'Maximum level reached' }));
      if (code === -2) return L.send(res, 402, Object.assign(st, { error: 'coins', message: 'Not enough coins' }));
      return L.send(res, 200, st);
    }
    return L.fail(res, 400, 'op');
  } catch (e) { return L.fail(res, 503, 'storage', 'Coins are unavailable right now'); }
};
module.exports.multiplier = multiplier;
module.exports.COSTS = COSTS;
module.exports.MULT = MULT;
