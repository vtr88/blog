<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

const DEFAULT_COLUMNS = [
    [
        'id' => 'problems',
        'title' => 'Problemas',
        'cards' => [
            [
                'id' => 'welcome-card',
                'title' => 'Bem-vindos ao quadro',
                'description' => 'Este cartao esta aqui so para mostrar o fluxo. Edite, arraste ou exclua quando as tarefas reais da familia chegarem.',
                'tags' => ['casa', 'exemplo'],
                'owner' => '',
                'tasks' => [
                    ['id' => 'welcome-task-1', 'text' => 'Clique no lapis para editar um cartao', 'done' => false],
                    ['id' => 'welcome-task-2', 'text' => 'Arraste o cartao para outra lista', 'done' => false],
                    ['id' => 'welcome-task-3', 'text' => 'Crie a primeira tarefa real da familia', 'done' => false],
                ],
            ],
        ],
    ],
    ['id' => 'assigned', 'title' => 'Atribuidos', 'cards' => []],
    ['id' => 'doing', 'title' => 'Em Andamento', 'cards' => []],
    ['id' => 'done', 'title' => 'Concluido', 'cards' => []],
];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    respond(read_state());
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '', true);

    if (!is_array($decoded)) {
        respond(['error' => 'Payload JSON invalido.'], 400);
    }

    save_state($decoded);
}

respond(['error' => 'Metodo nao permitido.'], 405);

function storage_path(): string
{
    $fromEnv = getenv('KANBAN_DATA_FILE');
    if (is_string($fromEnv) && $fromEnv !== '') {
        return $fromEnv;
    }

    return '/var/www/kanban-data/board.json';
}

function read_state(): array
{
    $path = storage_path();

    if (!is_file($path)) {
        return default_state();
    }

    $contents = file_get_contents($path);
    if ($contents === false) {
        respond(['error' => 'Nao foi possivel ler os dados do quadro.'], 500);
    }

    $decoded = json_decode($contents, true);
    if (!is_array($decoded)) {
        respond(['error' => 'Os dados salvos do quadro nao sao um JSON valido.'], 500);
    }

    return normalize_state($decoded);
}

function save_state(array $candidate): void
{
    $path = storage_path();
    $directory = dirname($path);

    if (!is_dir($directory) && !@mkdir($directory, 0775, true) && !is_dir($directory)) {
        respond([
            'error' => 'Nao foi possivel criar o diretorio de dados do kanban.',
            'hint' => 'Crie o diretorio manualmente e deixe gravavel pelo Apache. Exemplo: mkdir -p /var/www/kanban-data && chown www-data:www-data /var/www/kanban-data',
        ], 500);
    }

    $lockPath = $path . '.lock';
    $lockHandle = fopen($lockPath, 'c+');

    if ($lockHandle === false) {
        respond(['error' => 'Nao foi possivel criar o arquivo de lock dos dados do quadro.'], 500);
    }

    if (!flock($lockHandle, LOCK_EX)) {
        fclose($lockHandle);
        respond(['error' => 'Nao foi possivel bloquear os dados do quadro para salvar.'], 500);
    }

    $currentState = is_file($path) ? read_state() : default_state();
    $normalizedCandidate = normalize_state($candidate);
    $incomingVersion = isset($candidate['version']) && is_int($candidate['version']) ? $candidate['version'] : -1;

    if ($incomingVersion !== $currentState['version']) {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        respond([
            'error' => 'O quadro mudou em outro lugar. Recarregue e tente novamente.',
            'current' => $currentState,
        ], 409);
    }

    $nextState = [
        'version' => $currentState['version'] + 1,
        'updatedAt' => gmdate('c'),
        'columns' => $normalizedCandidate['columns'],
    ];

    $tempPath = $path . '.tmp';
    $bytes = file_put_contents($tempPath, json_encode($nextState, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    if ($bytes === false || !@rename($tempPath, $path)) {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        respond(['error' => 'Nao foi possivel persistir os dados do quadro.'], 500);
    }

    chmod($path, 0664);
    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);

    respond($nextState);
}

function default_state(): array
{
    return [
        'version' => 0,
        'updatedAt' => null,
        'columns' => DEFAULT_COLUMNS,
    ];
}

function normalize_state(array $state): array
{
    $columns = isset($state['columns']) && is_array($state['columns']) ? array_values($state['columns']) : DEFAULT_COLUMNS;
    $normalizedColumns = [];

    for ($index = 0; $index < 4; $index++) {
        $defaultColumn = DEFAULT_COLUMNS[$index];
        $column = $columns[$index] ?? $defaultColumn;

        $title = trim((string)($column['title'] ?? $defaultColumn['title']));
        $cards = isset($column['cards']) && is_array($column['cards']) ? array_values($column['cards']) : [];

        $normalizedCards = [];
        foreach ($cards as $cardIndex => $card) {
            if (!is_array($card)) {
                continue;
            }

            $cardTitle = trim((string)($card['title'] ?? ''));
            if ($cardTitle === '') {
                $cardTitle = 'Cartao sem titulo';
            }

            $normalizedTags = [];
            if (isset($card['tags']) && is_array($card['tags'])) {
                foreach ($card['tags'] as $tag) {
                    if (count($normalizedTags) >= 8) {
                        break;
                    }

                    $cleanTag = trim((string)$tag);
                    if ($cleanTag !== '') {
                        $normalizedTags[] = $cleanTag;
                    }
                }
            }

            $normalizedTasks = [];
            if (isset($card['tasks']) && is_array($card['tasks'])) {
                foreach ($card['tasks'] as $taskIndex => $task) {
                    if (count($normalizedTasks) >= 24 || !is_array($task)) {
                        continue;
                    }

                    $taskText = trim((string)($task['text'] ?? ''));
                    if ($taskText === '') {
                        continue;
                    }

                    $normalizedTasks[] = [
                        'id' => safe_id($task['id'] ?? ('task-' . $index . '-' . $cardIndex . '-' . $taskIndex)),
                        'text' => $taskText,
                        'done' => !empty($task['done']),
                    ];
                }
            }

            $normalizedCards[] = [
                'id' => safe_id($card['id'] ?? ('card-' . $index . '-' . $cardIndex)),
                'title' => $cardTitle,
                'description' => trim((string)($card['description'] ?? '')),
                'tags' => $normalizedTags,
                'owner' => normalize_owner($card['owner'] ?? ''),
                'tasks' => $normalizedTasks,
            ];
        }

        $normalizedColumns[] = [
            'id' => $defaultColumn['id'],
            'title' => $defaultColumn['title'],
            'cards' => $normalizedCards,
        ];
    }

    return [
        'version' => isset($state['version']) && is_int($state['version']) ? $state['version'] : 0,
        'updatedAt' => isset($state['updatedAt']) && is_string($state['updatedAt']) ? $state['updatedAt'] : null,
        'columns' => $normalizedColumns,
    ];
}

function safe_id($value): string
{
    $clean = preg_replace('/[^a-zA-Z0-9_-]+/', '-', (string)$value);
    $clean = trim((string)$clean, '-');

    return $clean !== '' ? $clean : uniqid('id-', true);
}

function normalize_owner($value): string
{
    return $value === 'me' || $value === 'wife' ? $value : '';
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}
