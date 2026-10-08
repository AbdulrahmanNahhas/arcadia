package io.nahhasio.client.library

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.nahhasio.client.generated.WorkDetail
import io.nahhasio.client.ui.*
import kotlinx.serialization.json.*

private val fieldLabels = mapOf(
    "id" to "المعرّف", "installmentCount" to "عدد الأجزاء", "episodeCount" to "عدد الحلقات", "number" to "رقم الحلقة", "position" to "الترتيب", "releaseState" to "الإصدار", "releaseDate" to "تاريخ الإصدار", "runtimeMinutes" to "المدة بالدقائق", "hasMediaFile" to "ملف فيديو مسجل", "durationSeconds" to "المدة بالثواني", "jellyfinLinked" to "مرتبط بـ Jellyfin", "sexualityRisk" to "المحتوى الجنسي", "behavioralRisk" to "السلوك", "theologyRisk" to "العقيدة", "kind" to "النوع", "isDefault" to "المسار الافتراضي", "isForced" to "ترجمة إجبارية", "codec" to "الترميز", "streamIndex" to "رقم المسار", "canonicalTitle" to "العنوان الأصلي", "titleAr" to "العنوان العربي", "releaseYear" to "سنة الإصدار",
    "format" to "الشكل", "audience" to "الجمهور", "age" to "العمر", "qualityScore" to "التقييم العام", "createdAt" to "أُضيف في", "updatedAt" to "آخر تحديث", "verifiedAt" to "آخر تحقق",
    "tones" to "الطابع", "tags" to "الوسوم", "countries" to "الدول", "planets" to "العوالم", "awards" to "الجوائز", "externalReferences" to "المراجع الخارجية", "curatorNotes" to "ملاحظات المحرر",
    "externalIds" to "معرّفات المصادر", "aliases" to "العناوين البديلة", "classification" to "التصنيف المطبق", "classificationOverrides" to "تعديلات تصنيف الجزء", "mediaFiles" to "ملفات الفيديو المسجلة", "tracks" to "مسارات الصوت والترجمة",
    "labelAr" to "الاسم العربي", "labelEn" to "الاسم", "name" to "الاسم", "title" to "العنوان", "description" to "الوصف", "language" to "اللغة", "url" to "الرابط", "notes" to "ملاحظات", "role" to "الدور", "slug" to "المعرّف النصي",
)

@Composable
fun WorkMetadata(work: WorkDetail, onOpenWork: (String) -> Unit = {}) {
    SectionHeading("بيانات العمل")
    WorkInfoRows(work.catalogFields(), setOf("canonicalTitle", "titleAr", "releaseYear", "format", "audience", "age", "installmentCount", "episodeCount"))
    if (work.aliases.isNotEmpty()) {
        SectionHeading("العناوين البديلة")
        work.aliases.forEach { alias -> Text(listOfNotNull(alias.title, alias.language, if (alias.isPreferred) "عنوان مفضل" else null).joinToString(" · ")) }
    }
    SectionHeading("معرّفات المصادر")
    Text(listOfNotNull(work.externalIds.tmdbId?.let { "TMDB: $it" }, work.externalIds.imdbId?.let { "IMDb: $it" }, work.externalIds.anilistId?.let { "AniList: $it" }, work.externalIds.malId?.let { "MAL: $it" }).joinToString(" · ").ifBlank { "لا توجد معرّفات مسجلة." })
    work.externalReferences.forEach { reference ->
        Text("${reference.provider} · ${reference.externalId}", style = MaterialTheme.typography.titleMedium)
        reference.url?.let { Text(it, color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall) }
    }
    TaxonomyGroup("الأنواع", work.genres)
    TaxonomyGroup("الطابع", work.tones)
    TaxonomyGroup("الوسوم", work.tags)
    TaxonomyGroup("الدول", work.countries)

    SectionHeading("الأعمال المرتبطة")
    if (work.relations.isEmpty()) Text("لا توجد علاقات مسجلة.", color = DesktopPalette.muted)
    work.relations.forEach { relation ->
        Surface(onClick = { onOpenWork(relation.workId) }, color = DesktopPalette.sidebar, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(relation.titleAr ?: relation.canonicalTitle, style = MaterialTheme.typography.titleMedium)
                Text("${relation.kind} · ${relation.direction}", color = DesktopPalette.muted)
                if (relation.notes.isNotBlank()) Text(relation.notes)

            }
        }
    }
    AdditionalMetadata("بيانات إضافية وتقنية للسجل", work.catalogFields(), work.catalogFields().keys)
}

@Composable
fun AdditionalMetadata(label: String, fields: JsonObject, keys: Set<String>) {
    var expanded by remember(label) { mutableStateOf(false) }
    DesktopButton(if (expanded) "إخفاء $label" else label, { expanded = !expanded })
    if (expanded) WorkInfoRows(fields, keys)
}

@Composable
fun WorkInfoRows(fields: JsonObject, keys: Set<String>) {
    keys.forEach { key -> fields[key]?.takeUnless { it is JsonNull || (it is JsonArray && it.isEmpty()) || (it is JsonPrimitive && it.contentOrNull.isNullOrBlank()) }?.let { value ->
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(fieldLabels[key] ?: key, color = DesktopPalette.muted, style = MaterialTheme.typography.labelMedium)
            MetadataValue(value)
        }
    } }
}

@Composable
private fun MetadataValue(value: JsonElement) {
    when (value) {
        is JsonPrimitive -> Text(readableValue(value.contentOrNull ?: "—"), style = MaterialTheme.typography.bodyMedium)
        is JsonArray -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { value.forEach { MetadataValue(it) } }
        is JsonObject -> {
            val name = value["labelAr"]?.jsonPrimitive?.contentOrNull?.takeIf(String::isNotBlank) ?: value["labelEn"]?.jsonPrimitive?.contentOrNull
            if (name != null && value.keys.all { it in setOf("id", "slug", "labelAr", "labelEn") }) Text(name)
            else Surface(color = DesktopPalette.surface, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { WorkInfoRows(value, value.keys) }
            }
        }
    }
}
