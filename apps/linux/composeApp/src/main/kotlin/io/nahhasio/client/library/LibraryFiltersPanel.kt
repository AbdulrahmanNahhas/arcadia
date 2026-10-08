package io.nahhasio.client.library

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.nahhasio.client.api.LibraryFilters
import io.nahhasio.client.generated.CatalogFilters
import io.nahhasio.client.ui.*

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LibraryFiltersPanel(filters: LibraryFilters, vocabulary: CatalogFilters?, busy: Boolean, onChange: (LibraryFilters) -> Unit) {
    var genre by remember(filters.genre) { mutableStateOf(filters.genre) }
    var from by remember(filters.yearFrom) { mutableStateOf(filters.yearFrom) }
    var to by remember(filters.yearTo) { mutableStateOf(filters.yearTo) }
    Column(Modifier.heightIn(max = 180.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DesktopChoice("الشكل", filters.format, listOf("" to "الكل", "animated" to "رسوم متحركة", "live-action" to "تمثيل حي")) { onChange(filters.copy(format = it, page = 1)) }
            DesktopChoice("الجمهور", filters.audience, listOf("" to "الكل", "general" to "عام", "teen" to "يافعين", "young-adult" to "شباب", "adult" to "بالغين")) { onChange(filters.copy(audience = it, page = 1)) }
            DesktopChoice("الحالة", filters.status, listOf("" to "الكل", "announced" to "معلن", "airing" to "يعرض", "completed" to "مكتمل", "unknown" to "غير معروف")) { onChange(filters.copy(status = it, page = 1)) }
            DesktopChoice("التصنيف", genre, listOf("" to "الكل") + vocabulary?.genres.orEmpty().map { it.slug to it.labelAr.ifBlank { it.labelEn } }) { genre = it; onChange(filters.copy(genre = it, page = 1)) }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DesktopInput(from, { from = normalizeYearInput(it) }, "من سنة", Modifier.width(130.dp))
            DesktopInput(to, { to = normalizeYearInput(it) }, "إلى سنة", Modifier.width(130.dp))
            DesktopButton("تطبيق السنوات", { onChange(filters.copy(yearFrom = from, yearTo = to, page = 1)) }, enabled = !busy)
            DesktopButton("مسح المرشحات", { onChange(LibraryFilters(query = filters.query, sort = filters.sort)) }, enabled = !busy)
        }
    }
}

fun normalizeYearInput(value: String): String = value.mapNotNull { it.digitToIntOrNull()?.toString() }.joinToString("").take(4)
