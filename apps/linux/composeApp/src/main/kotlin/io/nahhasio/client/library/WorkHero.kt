package io.nahhasio.client.library

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import io.nahhasio.client.api.NahhasioApi
import io.nahhasio.client.generated.WorkDetail
import io.nahhasio.client.playback.MpvPlayer
import io.nahhasio.client.ui.*

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkHero(api: NahhasioApi, work: WorkDetail) {
    var message by remember(work.id) { mutableStateOf<String?>(null) }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val compact = maxWidth < 680.dp
        val backdrop = work.artwork.firstOrNull { it.role in listOf("backdrop", "background", "banner") }
            ?: work.artwork.firstOrNull { it.width > it.height }
        Box(Modifier.fillMaxWidth().height(if (compact) 410.dp else 420.dp)) {
            backdrop?.let { Artwork(api, it.url, work.titleAr ?: work.canonicalTitle, Modifier.fillMaxSize()) }
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, DesktopPalette.canvas.copy(alpha = .68f), DesktopPalette.canvas))))
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = if (compact) 18.dp else 32.dp, vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(work.titleAr?.takeIf(String::isNotBlank) ?: work.canonicalTitle,
                    style = if (compact) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.displaySmall)
                if (!work.titleAr.isNullOrBlank()) Text(work.canonicalTitle, color = DesktopPalette.muted, style = MaterialTheme.typography.titleMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    work.releaseYear?.let { Text(it.toString(), style = MaterialTheme.typography.labelLarge) }
                    Text(if (work.format == "animated") "رسوم متحركة" else "تمثيل حي", style = MaterialTheme.typography.labelLarge)
                    Text("${work.installmentCount} أجزاء · ${work.episodeCount} حلقة", style = MaterialTheme.typography.labelLarge)
                    Text(work.age, style = MaterialTheme.typography.labelLarge)
                    Text("تقييم العمل ${work.qualityScore}", style = MaterialTheme.typography.labelLarge)
                }
                Text(work.genres.joinToString("  ·  ") { it.labelAr.ifBlank { it.labelEn } }, color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall)
                Text(work.summary, Modifier.widthIn(max = 680.dp), maxLines = if (compact) 2 else 3, style = MaterialTheme.typography.bodyMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    DesktopButton("فتح ملف محلي", { message = try { if (MpvPlayer.chooseVideoAndPlay()) "فُتح الفيديو في mpv" else null } catch (_: Exception) { "تعذر فتح المشغل. تحقق من تثبيت mpv." } }, primary = true)
                    DesktopButton("البث · قريباً", {}, enabled = false)
                    DesktopButton("حفظ العمل", {}, enabled = false)
                    DesktopButton("تنزيل الفيديو", {}, enabled = false)
                }
                message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
}
