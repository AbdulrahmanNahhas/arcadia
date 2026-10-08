package io.nahhasio.client.library

import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.nahhasio.client.api.NahhasioApi
import io.nahhasio.client.generated.WorkSummary
import io.nahhasio.client.ui.*

@Composable
fun PosterCard(api: NahhasioApi, work: WorkSummary, onOpen: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    val focused by interaction.collectIsFocusedAsState()
    val title = work.titleAr?.takeIf(String::isNotBlank) ?: work.canonicalTitle
    Column(Modifier.hoverable(interaction).clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onOpen).padding(3.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        val shape = RoundedCornerShape(9.dp)
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(shape).background(DesktopPalette.surface)
            .border(if (hovered || focused) 2.dp else 1.dp, if (hovered || focused) DesktopPalette.muted else DesktopPalette.border, shape)) {
            if (work.poster != null) Artwork(api, work.poster.url, title, Modifier.fillMaxSize())
            else Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.Center) {
                Text(title, style = MaterialTheme.typography.titleLarge)
                Text("بدون ملصق", color = DesktopPalette.muted, style = MaterialTheme.typography.labelSmall)
            }
        }
        Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(listOfNotNull(work.releaseYear?.toString(), if (work.format == "animated") "رسوم متحركة" else "تمثيل حي").joinToString("  ·  "),
            color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall, maxLines = 1)
    }
}
