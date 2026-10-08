package io.nahhasio.client.library

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.nahhasio.client.generated.WorkDetail
import io.nahhasio.client.generated.Vocabulary
import io.nahhasio.client.ui.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*

fun WorkDetail.catalogFields(): JsonObject = Json.encodeToJsonElement(this).jsonObject

@Composable
fun SectionHeading(title: String, note: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        note?.let { Text(it, color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkOverview(work: WorkDetail) {
    SectionHeading("القصة")
    Text(work.summary.ifBlank { "لم يُضف ملخص لهذا العمل بعد." }, Modifier.widthIn(max = 900.dp), style = MaterialTheme.typography.bodyLarge)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        work.genres.forEach { genre -> Surface(color = DesktopPalette.surface, shape = MaterialTheme.shapes.small) { Text(genre.labelAr.ifBlank { genre.labelEn }, Modifier.padding(horizontal = 12.dp, vertical = 7.dp), style = MaterialTheme.typography.bodySmall) } }
    }
    TaxonomyGroup("الطابع", work.tones)
    TaxonomyGroup("الوسوم", work.tags)
    TaxonomyGroup("الدول", work.countries)
    if (work.planets.isNotEmpty()) {
        SectionHeading("العوالم")
        work.planets.forEach { planet ->
            Text(planet.nameAr, style = MaterialTheme.typography.titleMedium)
            if (planet.description.isNotBlank()) Text(planet.description, color = DesktopPalette.muted)
        }
    }
    if (work.awards.isNotEmpty()) {
        SectionHeading("الجوائز")
        work.awards.forEach { award ->
            Surface(color = DesktopPalette.sidebar, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(award.organization?.nameAr ?: award.organizationName, style = MaterialTheme.typography.titleMedium)
                    Text(listOfNotNull(award.awardCategory?.nameAr ?: award.category, award.year?.toString(), readableValue(award.result)).joinToString(" · "))
                    award.ceremony?.label?.takeIf(String::isNotBlank)?.let { Text(it, color = DesktopPalette.muted) }
                    award.notes?.takeIf(String::isNotBlank)?.let { Text(it) }
                }
            }
        }
    }
    if (work.curatorNotes.isNotBlank()) { SectionHeading("ملاحظات إضافية"); Text(work.curatorNotes) }
    if (work.trivia.isNotEmpty()) {
        SectionHeading("حقائق عن العمل")
        work.trivia.forEach { Text("•  $it", style = MaterialTheme.typography.bodyMedium) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkEditorial(work: WorkDetail) {
    SectionHeading("ملاءمة المشاهدة", "تنبيهات العمل وتحليله عامة؛ تصنيف الحلقة يرث تصنيف جزئها.")
    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        RiskCard("الجمهور", readableValue(work.audience)); RiskCard("الفئة العمرية", work.age)
        RiskCard("المحتوى الجنسي", readableValue(work.sexualityRisk))
        RiskCard("السلوك", readableValue(work.behavioralRisk)); RiskCard("العقيدة", readableValue(work.theologyRisk))
    }
    SectionHeading("تنبيهات المحتوى")
    Text(work.contentWarnings?.takeIf(String::isNotBlank) ?: "لا توجد تنبيهات مسجلة.", Modifier.widthIn(max = 900.dp))
    SectionHeading("التحليل")
    Text(work.analysisNotes?.takeIf(String::isNotBlank) ?: "لم يُضف تحليل بعد.", Modifier.widthIn(max = 900.dp))
    SectionHeading("تقييم الأجزاء", "هذه الدرجات تخص الجزء، وليست تقييماً منفصلاً لكل حلقة.")
    work.installments.forEach { installment ->
        Surface(color = DesktopPalette.sidebar, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(installment.title.ifBlank { installment.kind }, style = MaterialTheme.typography.titleMedium)
                val scores = installment.scores
                if (scores == null) Text("لم يُقيّم هذا الجزء بعد.", color = DesktopPalette.muted)
                else FlowRow(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    listOf("القصة" to scores.story, "الشخصيات" to scores.characters, "العمق" to scores.depth, "بناء العالم" to scores.worldBuilding, "الأصالة" to scores.originality, "الصنعة" to scores.craft).forEach { (label, value) ->
                        Column(Modifier.widthIn(min = 90.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(value?.toString() ?: "—", style = MaterialTheme.typography.headlineMedium)
                            Text(label, color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                WorkInfoRows(Json.encodeToJsonElement(installment).jsonObject, setOf("classification", "classificationOverrides"))
            }
        }
    }
}

@Composable
private fun RiskCard(label: String, value: String) {
    Surface(color = DesktopPalette.surface, shape = MaterialTheme.shapes.small) {
        Column(Modifier.padding(16.dp).widthIn(min = 110.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = DesktopPalette.muted)
            Text(value, style = MaterialTheme.typography.titleMedium)
        }
    }
}

fun readableValue(value: String): String = when (value) {
    "none" -> "لا يوجد"; "low" -> "منخفض"; "moderate", "medium" -> "متوسط"; "high" -> "مرتفع"
    "general" -> "عام"; "teen" -> "يافعين"; "young-adult" -> "شباب"; "adult" -> "بالغين"
    "announced" -> "معلن"; "airing" -> "يعرض"; "completed" -> "مكتمل"
    "released" -> "صدر"; "upcoming" -> "قادم"; "unknown" -> "غير معروف"
    "won", "winner", "win" -> "فائز"; "nominated", "nominee" -> "مرشح"; "true" -> "نعم"; "false" -> "لا"; else -> value
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TaxonomyGroup(title: String, values: List<Vocabulary>) {
    if (values.isEmpty()) return
    var descriptions by remember(title) { mutableStateOf(false) }
    SectionHeading(title)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        values.forEach { value -> Surface(color = DesktopPalette.surface, shape = MaterialTheme.shapes.small) {
            Text(value.labelAr.ifBlank { value.labelEn }, Modifier.padding(horizontal = 12.dp, vertical = 7.dp), style = MaterialTheme.typography.bodySmall)
        } }
    }
    if (values.any { it.descriptionAr.isNotBlank() || it.descriptionEn.isNotBlank() }) {
        TextButton(onClick = { descriptions = !descriptions }) { Text(if (descriptions) "إخفاء الوصف" else "وصف التصنيفات") }
        if (descriptions) values.forEach { value ->
            val description = value.descriptionAr.ifBlank { value.descriptionEn }
            if (description.isNotBlank()) Text("${value.labelAr.ifBlank { value.labelEn }}: $description", color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall)
        }
    }
}
