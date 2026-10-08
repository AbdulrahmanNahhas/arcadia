package io.nahhasio.client.library

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.nahhasio.client.api.*
import io.nahhasio.client.generated.*
import io.nahhasio.client.ui.*

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LibraryScreen(api: NahhasioApi, filters: LibraryFilters, page: WorkPage?, busy: Boolean, onFilters: (LibraryFilters) -> Unit, onWork: (String) -> Unit) {
    var query by remember { mutableStateOf(filters.query) }
    var advanced by remember { mutableStateOf(false) }
    var vocabulary by remember(api) { mutableStateOf<CatalogFilters?>(null) }
    var filterError by remember(api) { mutableStateOf(false) }
    LaunchedEffect(api) {
        try { vocabulary = api.filters() }
        catch (e: kotlinx.coroutines.CancellationException) { throw e }
        catch (_: Exception) { filterError = true }
    }
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        BoxWithConstraints {
            val compact = maxWidth < 680.dp
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        if (!compact) Text("المكتبة", style = MaterialTheme.typography.labelMedium, color = DesktopPalette.muted)
                        Text("جميع الأعمال", style = if (compact) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.headlineLarge)
                    }
                    Text(page?.let { "${it.total} عمل" } ?: "…", color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    DesktopInput(query, { query = it }, "ابحث عن عمل…", Modifier.weight(1f), onSubmit = { onFilters(filters.copy(query = query, page = 1)) })
                    DesktopButton("بحث", { onFilters(filters.copy(query = query, page = 1)) }, enabled = !busy)
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    DesktopButton(if (advanced) "إغلاق المرشحات" else "المرشحات", { advanced = !advanced })
                    DesktopChoice("ترتيب", filters.sort, listOf("title" to "العنوان", "year-desc" to "الأحدث", "year-asc" to "الأقدم", "updated-desc" to "آخر تحديث")) { onFilters(filters.copy(sort = it, page = 1)) }
                }
            }
        }
        if (advanced) {
            LibraryFiltersPanel(filters, vocabulary, busy, onFilters)
            if (filterError) Text("تعذر تحميل التصنيفات. أعد الاتصال بالخادم.", color = MaterialTheme.colorScheme.error)
        }
        HorizontalDivider(color = DesktopPalette.border)
        if (page != null) {
            if (page.items.isEmpty()) Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("لا توجد أعمال مطابقة", style = MaterialTheme.typography.titleLarge)
                    Text("غيّر البحث أو امسح المرشحات لعرض المكتبة.", color = DesktopPalette.muted)
                    DesktopButton("عرض جميع الأعمال", { query = ""; onFilters(LibraryFilters()) })
                }
            } else BoxWithConstraints(Modifier.weight(1f)) {
                LazyVerticalGrid(columns = GridCells.Adaptive(if (maxWidth < 720.dp) 125.dp else 165.dp), modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    items(page.items, key = { it.id }) { work -> PosterCard(api, work) { onWork(work.id) } }
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("صفحة ${filters.page} من ${maxOf(1, (page.total + 23) / 24)}", Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = DesktopPalette.muted)
                DesktopButton("السابق", { onFilters(filters.copy(page = filters.page - 1)) }, enabled = !busy && filters.page > 1)
                DesktopButton("التالي", { onFilters(filters.copy(page = filters.page + 1)) }, enabled = !busy && filters.page * 24 < page.total)
            }
        }
    }
}
