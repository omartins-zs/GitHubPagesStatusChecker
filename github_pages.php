<?php
$username = 'omartins-zs';
$token = '';

function fetchWithToken($url, $token) {
    $headers = [
        'Accept: application/vnd.github.v3+json',
        'User-Agent: PHP'
    ];
    if ($token) {
        $headers[] = 'Authorization: token ' . $token;
    }
    $options = [
        'http' => [
            'header' => implode("\r\n", $headers),
        ]
    ];
    $context = stream_context_create($options);
    $response = @file_get_contents($url, false, $context);
    if ($response === FALSE) {
        throw new Exception("HTTP error!");
    }
    return json_decode($response, true);
}

function getRepos($username, $token) {
    $url = "https://api.github.com/users/$username/repos";
    return fetchWithToken($url, $token);
}

function checkGitHubPages($repo, $username) {
    $pagesUrl = "https://$username.github.io/{$repo['name']}/";
    $headers = @get_headers($pagesUrl, 1);
    $status = $headers ? substr($headers[0], 9, 3) : '500';

    if ($status == '404' && isset($headers['Content-Length']) && $headers['Content-Length'] > 0) {
        return ['url' => $pagesUrl, 'status' => 404, 'hosted' => true];
    }
    return ['url' => $pagesUrl, 'status' => (int)$status];
}

function listGitHubPagesRepos($username, $token) {
    try {
        $repos = getRepos($username, $token);
        foreach ($repos as $repo) {
            $result = checkGitHubPages($repo, $username);
            echo 'Repositório: ' . htmlspecialchars($repo['name']) . "<br>";
            echo 'Status: ' . $result['status'] . ' (' . getStatusText($result['status']) . ")<br>";
            if ($result['status'] === 200) {
                echo 'Projeto hospedado no GitHub Pages: <a href="' . htmlspecialchars($result['url']) . '" target="_blank">' . htmlspecialchars($result['url']) . '</a><br>';
            } elseif ($result['status'] === 404) {
                if ($result['hosted']) {
                    echo 'Projeto Hospedado - Arquivo não encontrado<br>';
                } else {
                    echo 'Página não Encontrada - Não Hospedado<br>';
                }
            } else {
                echo 'Erro ao acessar o GitHub Pages: ' . $result['status'] . "<br>";
            }
            echo "<br>";
        }
    } catch (Exception $e) {
        echo 'Erro ao obter repositórios: ' . $e->getMessage() . "<br>";
    }
}

function getStatusText($statusCode) {
    switch ($statusCode) {
        case 200:
            return 'Ok';
        case 404:
            return 'Not Found';
        default:
            return 'Error';
    }
}

listGitHubPagesRepos($username, $token);
?>
