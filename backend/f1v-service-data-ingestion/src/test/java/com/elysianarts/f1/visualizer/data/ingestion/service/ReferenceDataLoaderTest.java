package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.commons.api.openf1.service.OpenF1AuthService;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.InsertAllRequest;
import com.google.cloud.bigquery.InsertAllResponse;
import com.google.cloud.bigquery.TableId;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReferenceDataLoaderTest {

    private MockWebServer mockWebServer;

    @Mock
    private OpenF1AuthService authService;

    @Mock
    private BigQuery bigQuery;

    private ReferenceDataLoader referenceDataLoader;

    @BeforeEach
    void setUp() throws IOException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();

        // Build the WebClient here, pointing to the MockWebServer
        WebClient mockWebClient = WebClient.builder()
                .baseUrl(mockWebServer.url("/").toString())
                .build();

        // Inject the pre-built mock client!
        referenceDataLoader = new ReferenceDataLoader(mockWebClient, authService, bigQuery);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
    }

    @Test
    void loadReferenceData_FetchesAndInserts_SessionsAndDrivers() {
        // Arrange
        when(authService.getAccessToken()).thenReturn("test-token");
        when(bigQuery.insertAll(any(InsertAllRequest.class))).thenReturn(mock(InsertAllResponse.class));

        // Enqueue Mock Responses: First for /sessions, then for /drivers
        mockWebServer.enqueue(new MockResponse()
                .setBody("[{\"session_key\": 9165, \"meeting_name\": \"Singapore Grand Prix\"}]")
                .addHeader("Content-Type", "application/json"));

        mockWebServer.enqueue(new MockResponse()
                .setBody("[{\"driver_number\": 1, \"broadcast_name\": \"M VERSTAPPEN\", \"team_colour\": \"3671C6\"}]")
                .addHeader("Content-Type", "application/json"));

        // Act
        referenceDataLoader.loadReferenceData(2023);

        // Assert
        ArgumentCaptor<InsertAllRequest> requestCaptor = ArgumentCaptor.forClass(InsertAllRequest.class);
        verify(bigQuery, times(2)).insertAll(requestCaptor.capture());

        // Validate Sessions Insert (First Call)
        InsertAllRequest sessionsRequest = requestCaptor.getAllValues().get(0);
        TableId sessionsTable = sessionsRequest.getTable();
        assertEquals("f1_dataset", sessionsTable.getDataset());
        assertEquals("sessions", sessionsTable.getTable());
        assertEquals(1, sessionsRequest.getRows().size());
        assertTrue(sessionsRequest.getRows().get(0).getContent().containsValue(9165));

        // Validate Drivers Insert (Second Call)
        InsertAllRequest driversRequest = requestCaptor.getAllValues().get(1);
        TableId driversTable = driversRequest.getTable();
        assertEquals("f1_dataset", driversTable.getDataset());
        assertEquals("drivers", driversTable.getTable());
        assertEquals(1, driversRequest.getRows().size());
        assertTrue(driversRequest.getRows().get(0).getContent().containsValue(1));
    }
}