/**
 * Exercises MavlinkSession's mission-upload/download state machine
 * against a simulated vehicle (FakeVehicle below) that speaks the real
 * MAVLink mission protocol sequence — COUNT -> REQUEST_INT/ITEM_INT
 * per item -> ACK, and the mirrored download. This proves the
 * sequencing logic (what we send, what we wait for, in what order) is
 * correct in isolation. It does NOT prove a real Pixhawk behaves
 * exactly like FakeVehicle — ArduPilot's actual request/retry/timeout
 * behavior is real firmware behavior this test can't reach. See
 * VEHICLE_CONNECTION_CHECKLIST.md for what still needs real hardware.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFrame, MavlinkFrameReader, type DecodedFrame } from './mavlink/codec'
import {
  HEARTBEAT,
  MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
  MAV_MISSION_ACCEPTED,
  MISSION_ACK,
  MISSION_COUNT,
  MISSION_ITEM_INT,
  MISSION_REQUEST_INT,
  MISSION_REQUEST_LIST,
} from './mavlink/messages'
import { GCS_COMPID, GCS_SYSID, MavlinkSession } from './mavlinkSession'
import type { MissionWaypoint } from './types'

const VEHICLE_SYSID = 1
const VEHICLE_COMPID = 1

/** A minimal fake ArduPilot-like vehicle: answers the standard mission upload/download handshake. */
class FakeVehicle {
  private reader = new MavlinkFrameReader()
  private mission: Array<{ seq: number; command: number; x: number; y: number; z: number }> = []
  private seqCounter = 0
  onOutgoing: (bytes: Uint8Array) => void = () => {}
  rejectUploads = false

  receive(bytes: Uint8Array) {
    for (const frame of this.reader.push(bytes)) this.handle(frame)
  }

  sendHeartbeat() {
    this.send(HEARTBEAT, { customMode: 0, type: 2, autopilot: 3, baseMode: 81, systemStatus: 4, mavlinkVersion: 3 })
  }

  private send(def: Parameters<typeof encodeFrame>[0], values: Record<string, number>) {
    const frame = encodeFrame(def, values, { sysid: VEHICLE_SYSID, compid: VEHICLE_COMPID, seq: this.seqCounter++ & 0xff })
    this.onOutgoing(frame)
  }

  private handle(frame: DecodedFrame) {
    if (frame.msgId === MISSION_COUNT.id) {
      this.mission = new Array(frame.fields.count)
      if (frame.fields.count > 0) {
        this.send(MISSION_REQUEST_INT, { seq: 0, targetSystem: GCS_SYSID, targetComponent: GCS_COMPID })
      } else {
        this.send(MISSION_ACK, { targetSystem: GCS_SYSID, targetComponent: GCS_COMPID, type: MAV_MISSION_ACCEPTED })
      }
    } else if (frame.msgId === MISSION_ITEM_INT.id) {
      const f = frame.fields
      this.mission[f.seq] = { seq: f.seq, command: f.command, x: f.x, y: f.y, z: f.z }
      if (f.seq + 1 < this.mission.length) {
        this.send(MISSION_REQUEST_INT, { seq: f.seq + 1, targetSystem: GCS_SYSID, targetComponent: GCS_COMPID })
      } else if (this.rejectUploads) {
        this.send(MISSION_ACK, { targetSystem: GCS_SYSID, targetComponent: GCS_COMPID, type: 1 /* MAV_MISSION_ERROR */ })
      } else {
        this.send(MISSION_ACK, { targetSystem: GCS_SYSID, targetComponent: GCS_COMPID, type: MAV_MISSION_ACCEPTED })
      }
    } else if (frame.msgId === MISSION_REQUEST_LIST.id) {
      this.send(MISSION_COUNT, { count: this.mission.length, targetSystem: GCS_SYSID, targetComponent: GCS_COMPID })
    } else if (frame.msgId === MISSION_REQUEST_INT.id) {
      const item = this.mission[frame.fields.seq]
      this.send(MISSION_ITEM_INT, {
        seq: item.seq,
        command: item.command,
        x: item.x,
        y: item.y,
        z: item.z,
        targetSystem: GCS_SYSID,
        targetComponent: GCS_COMPID,
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
        current: 0,
        autocontinue: 1,
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
      })
    }
    // MISSION_ACK from the GCS (closing a download) needs no response.
  }
}

function setUp() {
  const vehicle = new FakeVehicle()
  const session = new MavlinkSession(async (bytes) => vehicle.receive(bytes))
  // Deliver the vehicle's reply on a later tick, not synchronously
  // within the same call stack as the outgoing write — a real serial
  // round-trip can never be faster than that, and delivering it
  // synchronously would let the reply arrive before uploadMission()
  // has even registered its waitForFrame() listener for it.
  vehicle.onOutgoing = (bytes) => {
    setTimeout(() => session.feedBytes(bytes), 0)
  }
  return { vehicle, session }
}

const SAMPLE_WAYPOINTS: MissionWaypoint[] = [
  { seq: 0, command: 16, altM: 3, position: { lat: 12.3456, lon: 76.5432 } },
  { seq: 1, command: 16, altM: 3, position: { lat: 12.3457, lon: 76.5433 } },
  { seq: 2, command: 16, altM: 3, position: { lat: 12.3458, lon: 76.5434 } },
]

describe('MavlinkSession + FakeVehicle', () => {
  it('resolves waitForHeartbeat once the vehicle sends one', async () => {
    const { vehicle, session } = setUp()
    const promise = session.waitForHeartbeat(1000)
    vehicle.sendHeartbeat()
    const frame = await promise
    expect(frame.msgId).toBe(HEARTBEAT.id)
  })

  it('captures the vehicle sysid/compid from its heartbeat', async () => {
    const { vehicle, session } = setUp()
    const promise = session.waitForHeartbeat(1000)
    vehicle.sendHeartbeat()
    await promise
    expect(session.getVehicleIdentity()).toEqual({ sysid: VEHICLE_SYSID, compid: VEHICLE_COMPID })
  })

  it('uploads a mission, reads it back, and verifies it matches', async () => {
    const { session } = setUp()
    const result = await session.uploadAndVerifyMission(SAMPLE_WAYPOINTS)

    expect(result.uploadedCount).toBe(3)
    expect(result.verified).toBe(true)
    expect(result.mismatches).toEqual([])
    expect(result.readBack).toHaveLength(3)
    for (const wp of SAMPLE_WAYPOINTS) {
      const match = result.readBack.find((r) => r.seq === wp.seq)!
      expect(match.position.lat).toBeCloseTo(wp.position.lat, 6)
      expect(match.position.lon).toBeCloseTo(wp.position.lon, 6)
      expect(match.altM).toBe(wp.altM)
      expect(match.command).toBe(wp.command)
    }
  })

  it('surfaces a vehicle-side mission rejection as a thrown error', async () => {
    const { vehicle, session } = setUp()
    vehicle.rejectUploads = true
    await expect(session.uploadAndVerifyMission(SAMPLE_WAYPOINTS)).rejects.toThrow(/rejected the mission/i)
  })

  it('handles an empty mission (zero waypoints) without hanging', async () => {
    const { session } = setUp()
    const result = await session.uploadAndVerifyMission([])
    expect(result.uploadedCount).toBe(0)
    expect(result.readBack).toEqual([])
    expect(result.verified).toBe(true)
  })
})

describe('MavlinkSession timeouts', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('rejects waitForHeartbeat if none arrives in time', async () => {
    const session = new MavlinkSession(async () => {})
    const promise = session.waitForHeartbeat(1000)
    const assertion = expect(promise).rejects.toThrow(/timed out/i)
    await vi.advanceTimersByTimeAsync(1001)
    await assertion
  })

  it('rejects uploadAndVerifyMission if the vehicle never answers MISSION_COUNT', async () => {
    const session = new MavlinkSession(async () => {}) // a "vehicle" that never responds to anything
    const promise = session.uploadAndVerifyMission(SAMPLE_WAYPOINTS)
    const assertion = expect(promise).rejects.toThrow(/timed out/i)
    await vi.advanceTimersByTimeAsync(3001)
    await assertion
  })
})
