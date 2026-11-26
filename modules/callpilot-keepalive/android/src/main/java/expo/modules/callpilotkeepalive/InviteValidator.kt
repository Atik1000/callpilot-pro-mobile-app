package expo.modules.callpilotkeepalive

import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/** Validation has no Android or JS dependency, so cold pushes fail closed. */
data class NativeInvitation(
  val callUuid: String,
  val organizationUid: String,
  val expiresAt: String,
  val action: String = "open",
  val active: Boolean = false,
  val actionAt: Long = 0,
) {
  fun toMap(): Map<String, Any> = mapOf(
    "call_uuid" to callUuid,
    "organization_uid" to organizationUid,
    "expires_at" to expiresAt,
    "action" to action,
    "call_active" to active,
    "action_at" to actionAt,
  )

  fun expiresMillis(): Long = requireNotNull(InviteValidator.timestampMillis(expiresAt))
}

object InviteValidator {
  private val uuidPattern = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
  private val timestampPattern = Regex("^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})(?:\\.(\\d{1,9}))?(Z|[+-]\\d{2}:\\d{2})$")
  fun isUuid(value: String): Boolean = uuidPattern.matches(value) && runCatching { UUID.fromString(value) }.isSuccess

  // java.time.Instant requires API 26. Keep cold receiving compatible with
  // this app's API 24 minimum, without adding an app-wide desugaring dependency.
  fun timestampMillis(value: String): Long? {
    val parts = timestampPattern.matchEntire(value) ?: return null
    val zone = parts.groupValues[3]
    if (zone != "Z" && (zone.substring(1, 3).toInt() > 23 || zone.substring(4, 6).toInt() > 59)) return null
    val normalized = parts.groupValues[1] + if (zone == "Z") "+0000" else zone.replace(":", "")
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.US).apply {
      isLenient = false
      timeZone = TimeZone.getTimeZone("UTC")
    }
    val position = ParsePosition(0)
    val date = format.parse(normalized, position) ?: return null
    if (position.index != normalized.length) return null
    val milliseconds = parts.groupValues[2].padEnd(3, '0').take(3).toInt()
    return date.time + milliseconds
  }

  fun parse(data: Map<String, String>, organizationUid: String, now: Long): NativeInvitation? {
    if (data["v"] != "1" || data["kind"] != "incoming_call") return null
    if (!isUuid(organizationUid) || data["organization_uid"] != organizationUid) return null
    val call = data["call_uuid"] ?: return null
    val expiry = data["expires_at"] ?: return null
    if (!isUuid(call)) return null
    val expires = timestampMillis(expiry) ?: return null
    // The backend never authorizes an invitation more than 60 seconds ahead.
    if (expires <= now || expires - now > 65_000L) return null
    val sent = data["sent_at"]?.let(::timestampMillis) ?: return null
    if (sent > now + 10_000L || sent >= expires || expires - sent > 65_000L) return null
    return NativeInvitation(call, organizationUid, expiry)
  }
}
