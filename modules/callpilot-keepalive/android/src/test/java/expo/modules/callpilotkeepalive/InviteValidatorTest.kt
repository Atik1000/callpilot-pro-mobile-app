package expo.modules.callpilotkeepalive

import org.junit.Assert.*
import org.junit.Test

class InviteValidatorTest {
  private val org = "55be809e-775d-4ae2-ae1c-63b5cd1ef729"
  private val call = "b6c8340a-16f4-4f9a-8a73-7b681ec11ca4"
  private val now = 1795600800000L
  private fun payload() = mapOf("v" to "1", "kind" to "incoming_call", "call_uuid" to call,
    "organization_uid" to org, "sent_at" to "2026-11-25T10:00:00Z", "expires_at" to "2026-11-25T10:00:25+00:00")

  @Test fun realBoundedInvitationAcceptedWithoutReact() {
    val result = InviteValidator.parse(payload(), org, now)!!
    assertEquals(call, result.toMap()["call_uuid"])
    assertEquals("open", result.toMap()["action"])
  }
  @Test fun expiredOrExcessivelyFutureInvitesDoNotRing() {
    assertNull(InviteValidator.parse(payload(), org, now + 25_000))
    assertNull(InviteValidator.parse(payload() + ("expires_at" to "2026-11-25T10:02:00Z"), org, now))
  }
  @Test fun otherBusinessOrMalformedIdentityCannotWakeSignedInBusiness() {
    assertNull(InviteValidator.parse(payload(), "64bc2ddf-37bf-481e-b347-b26eea089491", now))
    assertNull(InviteValidator.parse(payload() + ("call_uuid" to "1-1-1-1-1"), org, now))
    assertNull(InviteValidator.parse(payload(), "", now))
  }
  @Test fun genericMessagesAndMalformedClocksAreNotCalls() {
    assertNull(InviteValidator.parse(payload() + ("kind" to "callpilot_message"), org, now))
    assertNull(InviteValidator.parse(payload() + ("expires_at" to "tomorrow"), org, now))
    assertNull(InviteValidator.parse(payload() - "sent_at", org, now))
  }
  @Test fun timestampsSupportBackendOffsetsAndFractionsOnApi24() {
    assertEquals(now, InviteValidator.timestampMillis("2026-11-25T16:00:00+06:00"))
    assertEquals(now + 123, InviteValidator.timestampMillis("2026-11-25T10:00:00.123456Z"))
    assertNull(InviteValidator.timestampMillis("2026-02-30T10:00:00Z"))
    assertNull(InviteValidator.timestampMillis("2026-11-25T10:00:00+25:00"))
  }
}
