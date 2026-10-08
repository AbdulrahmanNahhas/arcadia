package io.nahhasio.client.library

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.nahhasio.client.api.NahhasioApi
import io.nahhasio.client.generated.WorkDetail
import io.nahhasio.client.generated.Episode
import io.nahhasio.client.ui.*
import kotlinx.serialization.json.*

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkEpisodes(api: NahhasioApi, work: WorkDetail, onEpisodeSelected: (String) -> Unit = {}) {
    var selectedInstallment by remember(work.id) { mutableStateOf(work.installments.firstOrNull()?.id) }
    var selectedEpisode by remember(selectedInstallment) { mutableStateOf<String?>(null) }
    var showInfo by remember(selectedInstallment) { mutableStateOf(false) }
    SectionHeading("الأجزاء والحلقات", "اختر الجزء، ثم الحلقة للاطلاع على تفاصيلها ومصادرها المسجلة.")
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        work.installments.forEachIndexed { index, installment -> DesktopButton(installment.title.ifBlank { "الجزء ${index + 1}" }, { selectedInstallment = installment.id }, primary = installment.id == selectedInstallment) }
    }
    val installment = work.installments.firstOrNull { it.id == selectedInstallment }
    if (installment == null) Text("لم تُضف أجزاء لهذا العمل بعد.", color = DesktopPalette.muted)
    else {
        Text(installment.summary, style = MaterialTheme.typography.bodyMedium)
        Text(listOfNotNull(installment.releaseDate, readableValue(installment.status), installment.runtimeMinutes?.let { "$it دقيقة" }).joinToString(" · "), color = DesktopPalette.muted)
        DesktopButton(if (showInfo) "إخفاء بيانات الجزء" else "بيانات الجزء كاملة", { showInfo = !showInfo })
        if (showInfo) WorkInfoRows(Json.encodeToJsonElement(installment).jsonObject,
            Json.encodeToJsonElement(installment).jsonObject.keys - setOf("episodes", "artwork", "summary", "title"))
        if (installment.episodes.isEmpty()) Text("لا توجد حلقات مسجلة لهذا الجزء.", color = DesktopPalette.muted)
        BoxWithConstraints {
            val cardWidth = if (maxWidth >= 740.dp) (maxWidth - 20.dp) / 2 else maxWidth
            FlowRow(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                installment.episodes.forEach { episode ->
                    Surface(onClick = { selectedEpisode = if (selectedEpisode == episode.id) null else episode.id; onEpisodeSelected(episode.id) },
                        color = if (selectedEpisode == episode.id) DesktopPalette.elevated else DesktopPalette.sidebar,
                        shape = MaterialTheme.shapes.medium, modifier = Modifier.width(cardWidth)) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            val still = episode.artwork.firstOrNull()
                            if (still != null) Artwork(api, still.url, episode.title ?: "الحلقة ${displayEpisodeNumber(episode.number)}", Modifier.fillMaxWidth().aspectRatio(16f / 9f))
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("الحلقة ${displayEpisodeNumber(episode.number)}", color = DesktopPalette.muted, style = MaterialTheme.typography.labelMedium)
                                Text(episode.title?.takeIf(String::isNotBlank) ?: "الحلقة ${displayEpisodeNumber(episode.number)}", style = MaterialTheme.typography.titleMedium)
                                Text(listOfNotNull(episode.releaseDate, episode.runtimeMinutes?.let { "$it دقيقة" }, episode.releaseState.takeUnless { it == "unknown" }?.let(::readableValue)).joinToString(" · "), color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall)
                                if (episode.summary.isNotBlank()) Text(episode.summary, maxLines = if (selectedEpisode == episode.id) Int.MAX_VALUE else 3)
                                Text(if (episode.hasMediaFile) "يوجد ملف فيديو مسجل" else "لم يُربط ملف فيديو", style = MaterialTheme.typography.bodySmall, color = DesktopPalette.muted)
                                if (selectedEpisode == episode.id) EpisodeDetails(episode)

                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EpisodeDetails(episode: Episode) {
    var showRecord by remember(episode.id) { mutableStateOf(false) }
    HorizontalDivider(color = DesktopPalette.border)
    WorkInfoRows(Json.encodeToJsonElement(episode).jsonObject, setOf("classification", "mediaFiles"))
    Text("التشغيل من المصدر المسجل سيُتاح بعد ربط خدمة التشغيل.", color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall)
    DesktopButton(if (showRecord) "إخفاء بيانات السجل" else "بيانات السجل", { showRecord = !showRecord })
    if (showRecord) WorkInfoRows(Json.encodeToJsonElement(episode).jsonObject, setOf("id", "number", "position", "createdAt", "updatedAt"))
}

fun displayEpisodeNumber(value: String): String = value.toBigDecimalOrNull()?.stripTrailingZeros()?.toPlainString() ?: value
