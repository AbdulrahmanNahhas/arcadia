package io.nahhasio.client.library

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.nahhasio.client.api.NahhasioApi
import io.nahhasio.client.generated.WorkDetail
import io.nahhasio.client.ui.*
import kotlinx.serialization.json.*

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkPeople(api: NahhasioApi, work: WorkDetail) {
    var expanded by remember(work.id) { mutableStateOf<String?>(null) }
    SectionHeading("الأشخاص والاستوديوهات", "المساهمات والأدوار المسجلة في مكتبتك.")
    if (work.contributions.isEmpty()) Text("لم تُضف مساهمات لهذا العمل بعد.", color = DesktopPalette.muted)
    BoxWithConstraints {
        val cardWidth = if (maxWidth > 720.dp) (maxWidth - 24.dp) / 3 else if (maxWidth > 480.dp) (maxWidth - 12.dp) / 2 else maxWidth
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            work.contributions.forEachIndexed { index, person ->
                val key = "${person.id}-$index"
                Surface(onClick = { expanded = if (expanded == key) null else key }, color = DesktopPalette.sidebar, shape = MaterialTheme.shapes.medium, modifier = Modifier.width(cardWidth)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            person.artwork.firstOrNull()?.let { Artwork(api, it.url, person.name, Modifier.width(64.dp).height(86.dp)) }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                Text(person.name, style = MaterialTheme.typography.titleMedium)
                                Text(person.roleLabelAr.ifBlank { person.roleLabelEn }, style = MaterialTheme.typography.bodySmall, color = DesktopPalette.muted)
                            }
                        }
                        if (expanded == key) {
                            if (person.description.isNotBlank()) Text(person.description)
                            person.roleDescriptionAr.ifBlank { person.roleDescriptionEn }.takeIf(String::isNotBlank)?.let { Text(it, color = DesktopPalette.muted) }
                            if (person.aliases.isNotEmpty()) Text(person.aliases.joinToString(" · ") { it.alias })
                            AdditionalMetadata("بيانات المساهم", Json.encodeToJsonElement(person).jsonObject, Json.encodeToJsonElement(person).jsonObject.keys)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkArtwork(api: NahhasioApi, work: WorkDetail) {
    SectionHeading("صور العمل", "الصور المسجلة للعمل وأجزائه وحلقاته.")
    val artwork = work.artwork + work.installments.flatMap { it.artwork + it.episodes.flatMap { episode -> episode.artwork } }
    if (artwork.isEmpty()) Text("لا توجد صور مسجلة.", color = DesktopPalette.muted)
    BoxWithConstraints {
        val cardWidth = if (maxWidth >= 700.dp) (maxWidth - 16.dp) / 2 else maxWidth
        FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            artwork.distinctBy { it.id }.forEach { asset ->
                Column(Modifier.width(cardWidth), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Artwork(api, asset.url, "صورة ${asset.role}", Modifier.fillMaxWidth().aspectRatio(if (asset.width > asset.height) 16f / 9f else 4f / 3f))
                    Text("${asset.role} · ${asset.width} × ${asset.height}", style = MaterialTheme.typography.bodySmall, color = DesktopPalette.muted)
                }
            }
        }
    }
}
