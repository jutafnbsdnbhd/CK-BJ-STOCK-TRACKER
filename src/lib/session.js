"use client";

// Who is logged in on this device. Not security — just a name tag on the
// movement rows so you know who keyed the entry.
const KEY = "bj-stock-staff";

export function saveStaff(staff) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(staff));
  } catch {
    /* private mode / storage blocked — the app still works, just re-picks */
  }
}

export function loadStaff() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStaff() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
