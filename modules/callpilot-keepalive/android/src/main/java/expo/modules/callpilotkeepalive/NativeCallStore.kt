package expo.modules.callpilotkeepalive

import android.content.Context
import org.json.JSONObject

/** Only nonsecret IDs and bounded invitation state are persisted here. */
object NativeCallStore {
  private const val FILE = "callpilot_native_invitations"
  private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  @Synchronized
  fun configure(context: Context, deviceUid: String, organizationUid: String) {
    require(InviteValidator.isUuid(deviceUid) && InviteValidator.isUuid(organizationUid)) { "Invalid device binding" }
    val store = prefs(context)
    if (store.getString("device", "") != deviceUid || store.getString("organization", "") != organizationUid) {
      NativeCalls.clearAll(context)
      store.edit().clear().putString("device", deviceUid).putString("organization", organizationUid).commit()
    }
  }

  fun organization(context: Context): String = prefs(context).getString("organization", "") ?: ""
  fun enabled(context: Context): Boolean = InviteValidator.isUuid(prefs(context).getString("device", "") ?: "") && InviteValidator.isUuid(organization(context))

  @Synchronized
  fun clearSession(context: Context) {
    prefs(context).edit().clear().commit()
    NativeCalls.clearAll(context)
  }

  @Synchronized
  fun accept(context: Context, data: Map<String, String>): NativeInvitation? {
    if (!enabled(context)) return null
    val now = System.currentTimeMillis()
    val invitation = InviteValidator.parse(data, organization(context), now) ?: return null
    val store = prefs(context)
    val seen = runCatching { JSONObject(store.getString("seen", "{}") ?: "{}") }.getOrDefault(JSONObject())
    for (key in seen.keys().asSequence().toList()) {
      if (seen.optLong(key, 0) <= now) seen.remove(key)
    }
    if (seen.has(invitation.callUuid)) return null
    // One handset has one current native call. Do not replace an established call.
    if (NativeCalls.hasActiveCall() || pending(context) != null) return null
    if (seen.length() >= 32) return null
    seen.put(invitation.callUuid, invitation.expiresMillis())
    store.edit().putString("seen", seen.toString()).putString("pending", JSONObject(invitation.toMap()).toString()).commit()
    return invitation
  }

  @Synchronized
  fun pending(context: Context): NativeInvitation? {
    if (!enabled(context)) return null
    val raw = prefs(context).getString("pending", null) ?: return null
    val value = runCatching {
      val item = JSONObject(raw)
      NativeInvitation(item.getString("call_uuid"), item.getString("organization_uid"), item.getString("expires_at"), item.optString("action", "open"), item.optBoolean("call_active", false), item.optLong("action_at", 0))
    }.getOrNull() ?: return null
    if (value.organizationUid != organization(context) || !InviteValidator.isUuid(value.callUuid) || value.action !in setOf("open", "answer", "decline")) return null
    val expiry = runCatching { value.expiresMillis() }.getOrNull() ?: return null
    val now = System.currentTimeMillis()
    val recentEndAction = value.action == "decline" && value.actionAt > 0 && now - value.actionAt in 0..30_000L
    // An active snapshot from a dead process cannot keep future calls blocked.
    // Actual media requires the live foreground call process. A recent end
    // action survives just long enough for bounded authenticated headless work.
    if (value.active && !NativeCalls.isActive(value.callUuid) && !recentEndAction) {
      prefs(context).edit().remove("pending").commit()
      return null
    }
    return value.takeIf { (value.active && NativeCalls.isActive(value.callUuid)) || recentEndAction || expiry > now }
  }

  @Synchronized
  fun action(context: Context, callUuid: String, action: String): NativeInvitation? {
    val value = pending(context)?.takeIf { it.callUuid == callUuid } ?: return null
    if (action !in setOf("open", "answer", "decline")) return null
    val updated = value.copy(action = action, actionAt = System.currentTimeMillis())
    prefs(context).edit().putString("pending", JSONObject(updated.toMap()).toString()).commit()
    return updated
  }

  @Synchronized
  fun save(context: Context, invitation: NativeInvitation) {
    if (enabled(context) && invitation.organizationUid == organization(context)) {
      prefs(context).edit().putString("pending", JSONObject(invitation.toMap()).toString()).commit()
    }
  }

  @Synchronized
  fun clear(context: Context, callUuid: String) {
    val raw = prefs(context).getString("pending", null) ?: return
    val current = runCatching { JSONObject(raw).optString("call_uuid") }.getOrNull()
    if (current == callUuid) prefs(context).edit().remove("pending").commit()
  }
}
