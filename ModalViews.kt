package uk.co.aegismedicalsolutions.eresus.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

@Composable
fun ResetModal(
    onDismiss: () -> Unit,
    onCopyAndReset: () -> Unit,
    onResetAnyway: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Reset Arrest Log?") },
        text = { Text("This will save the current log. This action cannot be undone.") },
        confirmButton = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Button(onClick = onCopyAndReset, modifier = Modifier.fillMaxWidth()) {
                    Text("Copy, Save & Reset")
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = onResetAnyway,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Reset & Save")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

// Other modals like Summary, Hypothermia, ETCO2, etc. would follow a similar pattern,
// using AlertDialog or a custom Dialog composable for more complex layouts.
